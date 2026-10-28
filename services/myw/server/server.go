// Package server is the service's HTTP side: bytes in, text out. It
// knows nothing of bug reports, file names or .bugreports/. The page
// is its client, from another origin, so cors.go guards every route.
// docs/features/001-calculator/prd.md section 5 and README.md.
//
//	GET    /healthz           ok, and the model's name; the page's probe
//	POST   /transcribe        a RIFF WAVE body in, the segments out as JSON
//	POST   /live              opens a live stream; live.go has the four live routes
//	POST   /live/{id}         a slice of 16-bit samples
//	GET    /live/{id}/events  SSE: partial, final, then end
//	DELETE /live/{id}         closes the stream, answers the span's segments
package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/ardanlabs/kronk/sdk/bucky/model"
)

// Segment is one line of the transcript: milliseconds into the audio
// the service was given, and the words.
type Segment struct {
	From int64  `json:"from"`
	To   int64  `json:"to"`
	Text string `json:"text"`
}

// Segments is a kronk transcription as the service answers it: never
// nil, so an empty one is [] and not null.
func Segments(tr model.Transcription) []Segment {
	var out = make([]Segment, 0, len(tr.Segments))
	for _, s := range tr.Segments {
		out = append(out, Segment{
			From: s.StartMs,
			To:   s.EndMs,
			Text: s.Text,
		})
	}
	return out
}

// Transcriber turns 16 kHz mono samples into segments. The real one
// is Model; a test stands a fake in.
type Transcriber interface {
	Transcribe(ctx context.Context, samples []float32) ([]Segment, error)
}

// Config is what the handler needs.
type Config struct {
	Transcriber Transcriber
	// Streamer opens the live streams; nil answers POST /live with a 503.
	Streamer Streamer
	// LiveIdle closes a live stream fed nothing for this long; zero is
	// 30 s.
	LiveIdle time.Duration
	// ModelName is what /healthz answers after ok.
	ModelName string
	// Origins is the CORS allowlist; see cors.go.
	Origins []string
	// Logger gets one line per request; nil logs nothing.
	Logger *log.Logger
	// Decode turns a WAV into samples; nil is kronk's model.Decode,
	// which resamples and downmixes what is not 16 kHz mono.
	Decode func(ctx context.Context, r io.Reader) ([]float32, error)
}

// maxWavBytes caps a body, as bff's audio route caps the same WAV: the
// page stops a narration at 30 minutes, about 58 MB.
const maxWavBytes = 64 << 20 // 64 MiB

// transcribeTimeout is the most one transcription may take.
const transcribeTimeout = 10 * time.Minute

// New builds the handler: the routes, under the CORS guard and the log.
// /healthz and /transcribe are registered by path so a wrong method is
// a 405 with its own message; the live routes by method and pattern,
// which the mux answers a 405 for itself.
func New(cfg Config) http.Handler {
	var (
		mux = http.NewServeMux()
		lv  = newLive(cfg)
		h   http.Handler
	)
	if cfg.Decode == nil {
		cfg.Decode = model.Decode
	}
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", http.MethodGet)
			httpError(w, http.StatusMethodNotAllowed, "/healthz takes GET")
			return
		}
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		fmt.Fprintf(w, "ok %s\n", cfg.ModelName)
	})
	mux.HandleFunc("/transcribe", func(w http.ResponseWriter, r *http.Request) {
		transcribe(w, r, cfg)
	})
	mux.HandleFunc("POST /live", lv.open)
	mux.HandleFunc("POST /live/{id}", lv.feed)
	mux.HandleFunc("GET /live/{id}/events", lv.events)
	mux.HandleFunc("DELETE /live/{id}", lv.closeStream)
	h = cors(cfg.Origins, allowMethods, mux)
	if cfg.Logger != nil {
		h = logging(h, cfg.Logger)
	}
	return h
}

// allowMethods is each route's methods, for a preflight's Allow-Methods.
func allowMethods(path string) string {
	switch {
	case path == "/healthz":
		return http.MethodGet
	case path == "/transcribe", path == "/live":
		return http.MethodPost
	case strings.HasPrefix(path, "/live/") && strings.HasSuffix(path, "/events"):
		return http.MethodGet
	case strings.HasPrefix(path, "/live/"):
		return http.MethodPost + ", " + http.MethodDelete
	}
	return ""
}

// isWave reports whether body starts as a RIFF WAVE file does: "RIFF",
// four bytes of length, then "WAVE". The same check as bff's audio
// route.
func isWave(body []byte) bool {
	return len(body) >= 12 && string(body[:4]) == "RIFF" && string(body[8:12]) == "WAVE"
}

// transcribe is POST /transcribe. 200 with the segments; 405, 413 and
// 400 for a request that is not one; 500 with the message when the
// transcription fails, which the report prints as the why.
func transcribe(w http.ResponseWriter, r *http.Request, cfg Config) {
	var (
		body        []byte
		tooBig      *http.MaxBytesError
		samples     []float32
		segs        []Segment
		out         []byte
		ctx, cancel = context.WithTimeout(r.Context(), transcribeTimeout)
		err         error
	)
	defer cancel()
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		httpError(w, http.StatusMethodNotAllowed, "/transcribe takes POST")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxWavBytes)
	if body, err = io.ReadAll(r.Body); err != nil {
		if errors.As(err, &tooBig) {
			httpError(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("request body over %d bytes", maxWavBytes))
			return
		}
		httpError(w, http.StatusBadRequest, "reading the request body: "+err.Error())
		return
	}
	if !isWave(body) {
		httpError(w, http.StatusBadRequest, "not a narration: the body is not a RIFF WAVE file")
		return
	}
	if samples, err = cfg.Decode(ctx, bytes.NewReader(body)); err != nil {
		httpError(w, http.StatusBadRequest, "not a narration: "+err.Error())
		return
	}
	if segs, err = cfg.Transcriber.Transcribe(ctx, samples); err != nil {
		httpError(w, http.StatusInternalServerError, "transcribing: "+err.Error())
		return
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

// httpError answers status with message as plain text, one line.
func httpError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	fmt.Fprintln(w, message)
}

// statusWriter keeps the status for the log line.
type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

// Unwrap lets http.ResponseController reach the Flusher under the
// wrapper, which the SSE needs.
func (w *statusWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

// logging writes one line per request: the method, the path, the
// origin when there is one, the status and the time. A 403 from the
// CORS guard is seen here.
func logging(next http.Handler, logger *log.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var (
			start  = time.Now()
			sw     = &statusWriter{ResponseWriter: w, status: http.StatusOK}
			origin = r.Header.Get("Origin")
		)
		next.ServeHTTP(sw, r)
		if origin != "" {
			origin = " from " + origin
		}
		logger.Printf("%s %s%s %d %s", r.Method, r.URL.Path, origin, sw.status, time.Since(start).Round(time.Millisecond))
	})
}
