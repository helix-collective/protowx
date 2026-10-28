package server

import (
	"bufio"
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/ardanlabs/kronk/sdk/bucky/model"
)

// fakeStream stands in for kronk's: it keeps what it is fed, and a test
// pushes events as the worker would.
type fakeStream struct {
	mu     sync.Mutex
	fed    [][]float32
	events chan model.Event
	closed bool
}

func (f *fakeStream) Feed(_ context.Context, samples []float32) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.closed {
		return errors.New("feed: stream closed")
	}
	f.fed = append(f.fed, append([]float32(nil), samples...))
	return nil
}

func (f *fakeStream) Events() <-chan model.Event {
	return f.events
}

func (f *fakeStream) Close() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if !f.closed {
		f.closed = true
		close(f.events)
	}
	return nil
}

func (f *fakeStream) emit(kind model.EventKind, text string, from, to int64) {
	f.events <- model.Event{
		Kind:    kind,
		Text:    text,
		StartMs: from,
		EndMs:   to,
	}
}

func (f *fakeStream) samples() int {
	var n int
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, s := range f.fed {
		n += len(s)
	}
	return n
}

// fakeStreamer opens fakeStreams, or fails.
type fakeStreamer struct {
	mu      sync.Mutex
	streams []*fakeStream
	err     error
}

func (f *fakeStreamer) NewStream(context.Context) (Stream, error) {
	var s = &fakeStream{
		events: make(chan model.Event, 16),
	}
	if f.err != nil {
		return nil, f.err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.streams = append(f.streams, s)
	return s, nil
}

func (f *fakeStreamer) last() *fakeStream {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.streams[len(f.streams)-1]
}

// liveHandler is the handler over a fake transcriber and a fake
// streamer, with the idle timeout given.
func liveHandler(tr *fake, st *fakeStreamer, idle time.Duration) http.Handler {
	return New(Config{
		Transcriber: tr,
		Streamer:    st,
		LiveIdle:    idle,
		ModelName:   "base.en",
		Origins:     origins,
	})
}

// slice is n samples of one value as the page posts them: 16-bit
// little-endian.
func slice(n int, v int16) []byte {
	var out = make([]byte, n*2)
	for i := range n {
		binary.LittleEndian.PutUint16(out[i*2:], uint16(v))
	}
	return out
}

// openStream posts /live and answers the id.
func openStream(t *testing.T, h http.Handler) string {
	t.Helper()
	var (
		rec  = send(h, http.MethodPost, "/live", nil, nil)
		body struct {
			ID string `json:"id"`
		}
	)
	if rec.Code != http.StatusOK {
		t.Fatalf("POST /live: %d %s", rec.Code, rec.Body.String())
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil || body.ID == "" {
		t.Fatalf("POST /live answered %q", rec.Body.String())
	}
	return body.ID
}

// sseLine is one message of the SSE: its id, its event and its data.
type sseLine struct {
	id, event, data string
}

// readSSE reads messages until the body ends, or until stop says so.
func readSSE(r io.Reader, stop func(got []sseLine) bool) []sseLine {
	var (
		br  = bufio.NewReader(r)
		got []sseLine
		cur sseLine
	)
	for {
		var line, err = br.ReadString('\n')
		line = strings.TrimRight(line, "\n")
		switch {
		case strings.HasPrefix(line, "id: "):
			cur.id = line[4:]
		case strings.HasPrefix(line, "event: "):
			cur.event = line[7:]
		case strings.HasPrefix(line, "data: "):
			cur.data = line[6:]
		case line == "" && cur.event != "":
			got = append(got, cur)
			cur = sseLine{}
			if stop != nil && stop(got) {
				return got
			}
		}
		if err != nil {
			return got
		}
	}
}

// TestLive: open, feed, the events in order on the SSE with
// [BLANK_AUDIO] dropped, close with the whole span's segments from the
// kept samples, end on the SSE, and the stream forgotten.
func TestLive(t *testing.T) {
	var (
		tr = &fake{
			segs: []Segment{
				{
					From: 0,
					To:   2400,
					Text: " The cell should move with the group.",
				},
			},
		}
		st     = &fakeStreamer{}
		h      = liveHandler(tr, st, 0)
		srv    = httptest.NewServer(h)
		id     = openStream(t, h)
		fs     = st.last()
		resp   *http.Response
		got    []sseLine
		segs   []Segment
		closed = make(chan []Segment, 1)
		err    error
	)
	defer srv.Close()
	// Two slices: 4000 samples at half scale, then 2000 at a quarter.
	for i, s := range [][]byte{slice(4000, 16384), slice(2000, 8192)} {
		var rec = send(h, http.MethodPost, "/live/"+id, s, map[string]string{
			"Content-Type": "application/octet-stream",
		})
		if rec.Code != http.StatusNoContent {
			t.Fatalf("feed %d: %d %s", i, rec.Code, rec.Body.String())
		}
	}
	if fs.samples() != 6000 || fs.fed[0][0] != 0.5 || fs.fed[1][0] != 0.25 {
		t.Errorf("the stream was fed %d samples, first %v and %v", fs.samples(), fs.fed[0][0], fs.fed[1][0])
	}
	fs.emit(model.EventPartial, " the cell", 0, 700)
	fs.emit(model.EventFinal, " [BLANK_AUDIO]", 0, 1000)
	fs.emit(model.EventPartial, " the cell should move", 0, 1400)
	fs.emit(model.EventFinal, " The cell should move with the group.", 0, 2400)
	if resp, err = http.Get(srv.URL + "/live/" + id + "/events"); err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if ct := resp.Header.Get("Content-Type"); ct != "text/event-stream" {
		t.Errorf("content type %q", ct)
	}
	// The three kept events, then the close from another goroutine, then end.
	got = readSSE(resp.Body, func(got []sseLine) bool { return len(got) == 3 })
	go func() {
		var (
			rec  *httptest.ResponseRecorder
			segs []Segment
		)
		time.Sleep(50 * time.Millisecond)
		if rec = send(h, http.MethodDelete, "/live/"+id, nil, nil); rec.Code != http.StatusOK {
			t.Errorf("DELETE: %d %s", rec.Code, rec.Body.String())
		} else if err := json.Unmarshal(rec.Body.Bytes(), &segs); err != nil {
			t.Error(err)
		}
		closed <- segs
	}()
	got = append(got, readSSE(resp.Body, nil)...)
	segs = <-closed
	if want := []sseLine{
		{"0", "partial", `{"from":0,"to":700,"text":"the cell"}`},
		{"1", "partial", `{"from":0,"to":1400,"text":"the cell should move"}`},
		{"2", "final", `{"from":0,"to":2400,"text":"The cell should move with the group."}`},
		{"3", "end", `{}`},
	}; len(got) != len(want) || got[0] != want[0] || got[1] != want[1] || got[2] != want[2] || got[3] != want[3] {
		t.Errorf("SSE got %+v, want %+v", got, want)
	}
	if len(segs) != 1 || segs[0] != tr.segs[0] {
		t.Errorf("the close answered %+v", segs)
	}
	if tr.calls != 1 || tr.samples != 6000 {
		t.Errorf("the whole-span pass saw %d calls, %d samples; want 1, 6000", tr.calls, tr.samples)
	}
	for _, tc := range []struct{ method, path string }{
		{http.MethodPost, "/live/" + id},
		{http.MethodGet, "/live/" + id + "/events"},
		{http.MethodDelete, "/live/" + id},
	} {
		if rec := send(h, tc.method, tc.path, slice(10, 1), nil); rec.Code != http.StatusNotFound {
			t.Errorf("%s %s after the close: %d", tc.method, tc.path, rec.Code)
		}
	}
}

// TestLiveReconnect: an EventSource that reconnects sends Last-Event-ID,
// and reads from the event after it.
func TestLiveReconnect(t *testing.T) {
	var (
		st  = &fakeStreamer{}
		h   = liveHandler(&fake{}, st, 0)
		id  = openStream(t, h)
		fs  = st.last()
		rec *httptest.ResponseRecorder
		got []sseLine
	)
	fs.emit(model.EventFinal, "one", 0, 1000)
	fs.emit(model.EventFinal, "two", 1000, 2000)
	_ = fs.Close()
	// The pump writes end once the events close; the GET then returns.
	for i := 0; i < 200; i++ {
		if rec = send(h, http.MethodGet, "/live/"+id+"/events", nil, map[string]string{
			"Last-Event-ID": "0",
		}); strings.Contains(rec.Body.String(), "event: end") {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	got = readSSE(bytes.NewReader(rec.Body.Bytes()), nil)
	if len(got) != 2 || got[0].id != "1" || got[0].data != `{"from":1000,"to":2000,"text":"two"}` || got[1].event != "end" {
		t.Errorf("after Last-Event-ID 0 got %+v", got)
	}
}

// TestLiveUnknown: an unknown id is a 404 on each of the three routes,
// and a GET on /live a 405.
func TestLiveUnknown(t *testing.T) {
	var h = liveHandler(&fake{}, &fakeStreamer{}, 0)
	for _, tc := range []struct{ method, path string }{
		{http.MethodPost, "/live/nope"},
		{http.MethodGet, "/live/nope/events"},
		{http.MethodDelete, "/live/nope"},
	} {
		if rec := send(h, tc.method, tc.path, slice(10, 1), nil); rec.Code != http.StatusNotFound || !strings.Contains(rec.Body.String(), "nope") {
			t.Errorf("%s %s: %d %q", tc.method, tc.path, rec.Code, rec.Body.String())
		}
	}
	if rec := send(h, http.MethodGet, "/live", nil, nil); rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("GET /live: %d", rec.Code)
	}
}

// TestLiveFeedRefusals: an odd slice or an empty one is a 400, one over
// the cap a 413, and the stream is fed nothing.
func TestLiveFeedRefusals(t *testing.T) {
	var (
		st = &fakeStreamer{}
		h  = liveHandler(&fake{}, st, 0)
		id = openStream(t, h)
	)
	for _, tc := range []struct {
		name string
		body []byte
		want int
	}{
		{"odd", []byte{1, 2, 3}, http.StatusBadRequest},
		{"empty", nil, http.StatusBadRequest},
		{"over the cap", make([]byte, maxSliceBytes+2), http.StatusRequestEntityTooLarge},
	} {
		if rec := send(h, http.MethodPost, "/live/"+id, tc.body, nil); rec.Code != tc.want {
			t.Errorf("%s: %d %s", tc.name, rec.Code, rec.Body.String())
		}
	}
	if st.last().samples() != 0 {
		t.Errorf("the stream was fed %d samples", st.last().samples())
	}
}

// TestLiveIdle: a stream fed nothing for the idle time is closed: its
// events end with end, a feed is refused, and the close still answers,
// [] for a span with no samples.
func TestLiveIdle(t *testing.T) {
	var (
		st  = &fakeStreamer{}
		h   = liveHandler(&fake{}, st, 30*time.Millisecond)
		id  = openStream(t, h)
		rec *httptest.ResponseRecorder
		got []sseLine
	)
	time.Sleep(100 * time.Millisecond)
	rec = send(h, http.MethodGet, "/live/"+id+"/events", nil, nil)
	got = readSSE(bytes.NewReader(rec.Body.Bytes()), nil)
	if len(got) != 1 || got[0].event != "end" {
		t.Errorf("after the idle close the SSE got %+v", got)
	}
	if rec = send(h, http.MethodPost, "/live/"+id, slice(10, 1), nil); rec.Code != http.StatusConflict {
		t.Errorf("a feed after the idle close: %d %s", rec.Code, rec.Body.String())
	}
	if rec = send(h, http.MethodDelete, "/live/"+id, nil, nil); rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != "[]" {
		t.Errorf("the close after idle: %d %q", rec.Code, rec.Body.String())
	}
}

// TestLiveOpenFails: a streamer that fails is a 500 with the message;
// with no streamer, a 503.
func TestLiveOpenFails(t *testing.T) {
	var (
		h   = liveHandler(&fake{}, &fakeStreamer{err: errors.New("the model is not loaded")}, 0)
		rec = send(h, http.MethodPost, "/live", nil, nil)
	)
	if rec.Code != http.StatusInternalServerError || !strings.Contains(rec.Body.String(), "the model is not loaded") {
		t.Errorf("got %d %q", rec.Code, rec.Body.String())
	}
	h = New(Config{
		Transcriber: &fake{},
		Origins:     origins,
	})
	if rec = send(h, http.MethodPost, "/live", nil, nil); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("with no streamer got %d", rec.Code)
	}
}

// TestLiveCloseFails: the whole-span pass failing is a 500 with the
// message, and the page then keeps the span's finals.
func TestLiveCloseFails(t *testing.T) {
	var (
		st = &fakeStreamer{}
		h  = liveHandler(&fake{err: errors.New("out of memory")}, st, 0)
		id = openStream(t, h)
	)
	send(h, http.MethodPost, "/live/"+id, slice(100, 1), nil)
	if rec := send(h, http.MethodDelete, "/live/"+id, nil, nil); rec.Code != http.StatusInternalServerError || !strings.Contains(rec.Body.String(), "out of memory") {
		t.Errorf("got %d %q", rec.Code, rec.Body.String())
	}
}

// TestLiveCORS: the SSE from a listed origin carries the header; from
// another it is a 403; the preflights name each live route's methods.
func TestLiveCORS(t *testing.T) {
	var (
		st  = &fakeStreamer{}
		h   = liveHandler(&fake{}, st, 30*time.Millisecond)
		id  = openStream(t, h)
		rec *httptest.ResponseRecorder
	)
	time.Sleep(100 * time.Millisecond)
	rec = send(h, http.MethodGet, "/live/"+id+"/events", nil, map[string]string{
		"Origin": "http://127.0.0.1:8080",
	})
	if rec.Code != http.StatusOK || rec.Header().Get("Access-Control-Allow-Origin") != "http://127.0.0.1:8080" {
		t.Errorf("the SSE from a listed origin: %d, header %q", rec.Code, rec.Header().Get("Access-Control-Allow-Origin"))
	}
	if !strings.Contains(rec.Body.String(), "event: end") {
		t.Errorf("the SSE body %q", rec.Body.String())
	}
	rec = send(h, http.MethodGet, "/live/"+id+"/events", nil, map[string]string{
		"Origin": "https://evil.example",
	})
	if rec.Code != http.StatusForbidden || rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("the SSE from another origin: %d", rec.Code)
	}
	for path, want := range map[string]string{
		"/live":                   "POST",
		"/live/" + id:             "POST, DELETE",
		"/live/" + id + "/events": "GET",
	} {
		rec = send(h, http.MethodOptions, path, nil, map[string]string{
			"Origin":                        "http://127.0.0.1:8080",
			"Access-Control-Request-Method": http.MethodPost,
		})
		if rec.Code != http.StatusNoContent || rec.Header().Get("Access-Control-Allow-Methods") != want {
			t.Errorf("preflight %s: %d, methods %q, want %q", path, rec.Code, rec.Header().Get("Access-Control-Allow-Methods"), want)
		}
	}
}
