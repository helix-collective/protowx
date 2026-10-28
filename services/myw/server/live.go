package server

// The live streams: one per span of the narration, fed slices of the
// page's own 16 kHz samples while the user talks, with the partials and
// the finals back over Server-Sent Events. The service keeps a stream's
// samples, and the close transcribes the whole span from them, so the
// report gets whole sentences and the service is not sent the WAV as
// well. README.md, "The live streams".
//
//	POST   /live              opens a stream on the loaded model; answers { "id" }
//	POST   /live/{id}         a slice of 16-bit little-endian samples, fed and kept
//	GET    /live/{id}/events  SSE: partial, final, each { "text", "from", "to" }; then end
//	DELETE /live/{id}         closes the stream, transcribes the kept samples whole
//
// A stream fed nothing for LiveIdle is closed by the service, and its
// events end with end; its samples wait for the DELETE a while longer.

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ardanlabs/kronk/sdk/bucky/model"
)

// Stream is one live transcription. kronk's *model.Stream is the real
// one; a test stands a fake in.
type Stream interface {
	Feed(ctx context.Context, samples []float32) error
	Events() <-chan model.Event
	Close() error
}

// Streamer opens a Stream on the loaded model. Model is the real one.
type Streamer interface {
	NewStream(ctx context.Context) (Stream, error)
}

const (
	// partialEveryMs is how often a stream decodes a partial.
	partialEveryMs = 700
	// defaultLiveIdle closes a stream fed nothing for this long.
	defaultLiveIdle = 30 * time.Second
	// forgetAfter is how long a closed stream's kept samples wait for the
	// DELETE before the service forgets them.
	forgetAfter = 10 * time.Minute
	// maxSliceBytes caps one feed: 30 s of 16-bit samples is 960 kB, and
	// the page posts about 250 ms.
	maxSliceBytes = 1 << 20
	// maxKeptSamples caps what a stream keeps for the close: the page's
	// own limit of 30 minutes.
	maxKeptSamples = 16000 * 30 * 60
	// blankAudio is what whisper says for silence; it is dropped.
	blankAudio = "[BLANK_AUDIO]"
)

// liveEvent is one line of the SSE: partial, final or end.
type liveEvent struct {
	Kind string
	Seg  Segment
}

// liveStream is one open stream: kronk's, the samples kept for the
// close, and the events so far, which a late or a reconnecting
// EventSource reads from its cursor.
type liveStream struct {
	id     string
	stream Stream
	cfg    Config

	mu      sync.Mutex
	kept    []int16
	events  []liveEvent
	changed chan struct{}
	closed  bool
	idle    *time.Timer

	shutOnce sync.Once
	// done closes once the pump has written end.
	done chan struct{}
}

// live is the registry of open streams, by id.
type live struct {
	cfg     Config
	mu      sync.Mutex
	streams map[string]*liveStream
}

func newLive(cfg Config) *live {
	if cfg.LiveIdle <= 0 {
		cfg.LiveIdle = defaultLiveIdle
	}
	return &live{
		cfg:     cfg,
		streams: map[string]*liveStream{},
	}
}

// open is POST /live.
func (l *live) open(w http.ResponseWriter, r *http.Request) {
	var (
		s   Stream
		id  string
		ls  *liveStream
		out []byte
		err error
	)
	if l.cfg.Streamer == nil {
		httpError(w, http.StatusServiceUnavailable, "the service has no live streams")
		return
	}
	if s, err = l.cfg.Streamer.NewStream(r.Context()); err != nil {
		httpError(w, http.StatusInternalServerError, "opening a stream: "+err.Error())
		return
	}
	if id, err = newID(); err != nil {
		_ = s.Close()
		httpError(w, http.StatusInternalServerError, err.Error())
		return
	}
	ls = &liveStream{
		id:      id,
		stream:  s,
		cfg:     l.cfg,
		changed: make(chan struct{}),
		done:    make(chan struct{}),
	}
	// Under the stream's mutex: shut reads the timer under it, and a
	// short idle time can fire before this handler returns.
	ls.mu.Lock()
	ls.idle = time.AfterFunc(l.cfg.LiveIdle, func() { l.idleClose(ls) })
	ls.mu.Unlock()
	l.mu.Lock()
	l.streams[id] = ls
	l.mu.Unlock()
	go ls.pump()
	if out, err = json.Marshal(map[string]string{
		"id": id,
	}); err != nil {
		httpError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(out)
}

// lookup answers the stream of the request's id, or writes the 404.
func (l *live) lookup(w http.ResponseWriter, r *http.Request) *liveStream {
	var (
		id = r.PathValue("id")
		ls *liveStream
		ok bool
	)
	l.mu.Lock()
	ls, ok = l.streams[id]
	l.mu.Unlock()
	if !ok {
		httpError(w, http.StatusNotFound, "no live stream "+id)
		return nil
	}
	return ls
}

// feed is POST /live/{id}: a slice of 16-bit little-endian samples.
func (l *live) feed(w http.ResponseWriter, r *http.Request) {
	var (
		ls      = l.lookup(w, r)
		body    []byte
		tooBig  *http.MaxBytesError
		samples []float32
		err     error
	)
	if ls == nil {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxSliceBytes)
	if body, err = io.ReadAll(r.Body); err != nil {
		if errors.As(err, &tooBig) {
			httpError(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("a slice over %d bytes", maxSliceBytes))
			return
		}
		httpError(w, http.StatusBadRequest, "reading the slice: "+err.Error())
		return
	}
	if len(body) == 0 || len(body)%2 != 0 {
		httpError(w, http.StatusBadRequest, "a slice is 16-bit little-endian samples: an even number of bytes, more than none")
		return
	}
	if samples, err = ls.keep(body); err != nil {
		httpError(w, http.StatusConflict, err.Error())
		return
	}
	if err = ls.stream.Feed(r.Context(), samples); err != nil {
		httpError(w, http.StatusInternalServerError, "feeding the stream: "+err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// keep converts the slice, keeps it for the close and resets the idle
// timer. A closed stream refuses it.
func (s *liveStream) keep(body []byte) ([]float32, error) {
	var (
		n       = len(body) / 2
		samples = make([]float32, n)
		ints    = make([]int16, n)
	)
	for i := range n {
		ints[i] = int16(binary.LittleEndian.Uint16(body[i*2:]))
		samples[i] = float32(ints[i]) / 32768
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil, fmt.Errorf("the stream %s is closed", s.id)
	}
	if room := maxKeptSamples - len(s.kept); n > room {
		ints = ints[:room]
	}
	s.kept = append(s.kept, ints...)
	s.idle.Reset(s.cfg.LiveIdle)
	return samples, nil
}

// pump reads kronk's events and keeps them for the SSE: a partial and
// a final as { "text", "from", "to" }, [BLANK_AUDIO] dropped, and end
// once the stream's events close.
func (s *liveStream) pump() {
	for ev := range s.stream.Events() {
		var (
			kind string
			text = strings.TrimSpace(strings.ReplaceAll(ev.Text, blankAudio, ""))
		)
		switch ev.Kind {
		case model.EventPartial:
			kind = "partial"
		case model.EventFinal:
			kind = "final"
		default:
			continue
		}
		if text == "" {
			continue
		}
		s.append(liveEvent{
			Kind: kind,
			Seg: Segment{
				From: ev.StartMs,
				To:   ev.EndMs,
				Text: text,
			},
		})
	}
	s.append(liveEvent{
		Kind: "end",
	})
	close(s.done)
}

func (s *liveStream) append(ev liveEvent) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.events = append(s.events, ev)
	close(s.changed)
	s.changed = make(chan struct{})
}

// since answers the events from the cursor, and the channel that closes
// at the next one.
func (s *liveStream) since(from int) ([]liveEvent, <-chan struct{}) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if from > len(s.events) {
		from = len(s.events)
	}
	return append([]liveEvent(nil), s.events[from:]...), s.changed
}

// events is GET /live/{id}/events, the SSE. It writes the events from
// the cursor, Last-Event-ID plus one on a reconnect, then waits for
// more, and ends after end or when the page goes.
func (l *live) events(w http.ResponseWriter, r *http.Request) {
	var (
		ls   = l.lookup(w, r)
		rc   = http.NewResponseController(w)
		from int
		evs  []liveEvent
		more <-chan struct{}
		err  error
	)
	if ls == nil {
		return
	}
	if last := r.Header.Get("Last-Event-ID"); last != "" {
		if from, err = strconv.Atoi(last); err != nil || from < 0 {
			from = 0
		} else {
			from++
		}
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	for {
		evs, more = ls.since(from)
		for _, ev := range evs {
			if err = writeEvent(w, from, ev); err != nil {
				return
			}
			from++
			if ev.Kind == "end" {
				_ = rc.Flush()
				return
			}
		}
		if err = rc.Flush(); err != nil {
			return
		}
		select {
		case <-more:
		case <-r.Context().Done():
			return
		}
	}
}

// writeEvent is one SSE message: its id, its kind, and the segment as
// JSON, or {} for end.
func writeEvent(w io.Writer, id int, ev liveEvent) error {
	var (
		data []byte
		err  error
	)
	if ev.Kind == "end" {
		data = []byte("{}")
	} else if data, err = json.Marshal(ev.Seg); err != nil {
		return err
	}
	_, err = fmt.Fprintf(w, "id: %d\nevent: %s\ndata: %s\n\n", id, ev.Kind, data)
	return err
}

// shut closes kronk's stream once, refuses further feeds, and waits for
// the pump to write end.
func (s *liveStream) shut() {
	s.shutOnce.Do(func() {
		s.mu.Lock()
		s.closed = true
		s.idle.Stop()
		s.mu.Unlock()
		_ = s.stream.Close()
		<-s.done
	})
}

// idleClose is the idle timer's: the stream is closed, its events end,
// and its samples wait forgetAfter for the DELETE.
func (l *live) idleClose(ls *liveStream) {
	ls.shut()
	time.AfterFunc(forgetAfter, func() { l.forget(ls) })
}

// forget drops the stream from the registry, if it is still the one
// under its id.
func (l *live) forget(ls *liveStream) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.streams[ls.id] == ls {
		delete(l.streams, ls.id)
	}
}

// closeStream is DELETE /live/{id}: the stream is closed and forgotten,
// and the kept samples are transcribed whole; the segments are the
// answer, [] for a stream fed nothing. A failure of the whole-span
// pass is a 500 with the message, and the page keeps the span's finals.
func (l *live) closeStream(w http.ResponseWriter, r *http.Request) {
	var (
		ls          = l.lookup(w, r)
		samples     []float32
		segs        []Segment
		out         []byte
		ctx, cancel = context.WithTimeout(r.Context(), transcribeTimeout)
		err         error
	)
	defer cancel()
	if ls == nil {
		return
	}
	l.forget(ls)
	ls.shut()
	ls.mu.Lock()
	samples = make([]float32, len(ls.kept))
	for i, v := range ls.kept {
		samples[i] = float32(v) / 32768
	}
	ls.mu.Unlock()
	if len(samples) > 0 {
		if segs, err = l.cfg.Transcriber.Transcribe(ctx, samples); err != nil {
			httpError(w, http.StatusInternalServerError, "transcribing the span: "+err.Error())
			return
		}
	}
	if segs == nil {
		segs = []Segment{}
	}
	if out, err = json.Marshal(segs); err != nil {
		httpError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(out)
}

// newID is 16 hex characters from the system's random source.
func newID() (string, error) {
	var (
		b   = make([]byte, 8)
		err error
	)
	if _, err = rand.Read(b); err != nil {
		return "", fmt.Errorf("making a stream id: %w", err)
	}
	return hex.EncodeToString(b), nil
}
