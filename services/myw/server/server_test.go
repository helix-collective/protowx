package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

// fixture is the narration a test plays: testdata/narration.wav, 7.13 s of synthetic speech, 16 kHz mono.
const fixture = "../testdata/narration.wav"

// fake is a Transcriber that answers what it is given, and remembers
// whether it was called and how many samples it saw.
type fake struct {
	segs    []Segment
	err     error
	calls   int
	samples int
}

func (f *fake) Transcribe(_ context.Context, samples []float32) ([]Segment, error) {
	f.calls++
	f.samples = len(samples)
	return f.segs, f.err
}

var origins = []string{
	"http://127.0.0.1:8080",
	"https://bff-main.tail1234.ts.net",
}

func handler(f *fake) http.Handler {
	return New(Config{
		Transcriber: f,
		ModelName:   "base.en",
		Origins:     origins,
	})
}

// send makes one request with body and the headers, and answers the
// recorder.
func send(h http.Handler, method, path string, body []byte, headers map[string]string) *httptest.ResponseRecorder {
	var (
		rec = httptest.NewRecorder()
		req = httptest.NewRequest(method, path, bytes.NewReader(body))
	)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	h.ServeHTTP(rec, req)
	return rec
}

func wavFixture(t *testing.T) []byte {
	t.Helper()
	var (
		data []byte
		err  error
	)
	if data, err = os.ReadFile(fixture); err != nil {
		t.Fatal(err)
	}
	return data
}

// TestTranscribe: the fixture's bytes in, the fake's segments out, with
// the fixture's 7.13 s of samples handed to the transcriber.
func TestTranscribe(t *testing.T) {
	var (
		f = &fake{
			segs: []Segment{
				{
					From: 0,
					To:   2400,
					Text: " And now I rename the group.",
				},
			},
		}
		rec  = send(handler(f), http.MethodPost, "/transcribe", wavFixture(t), nil)
		got  []Segment
		want = f.segs
	)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Errorf("content type %q", ct)
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0] != want[0] {
		t.Errorf("segments got %+v, want %+v", got, want)
	}
	if f.samples < 7_000*16 || f.samples > 7_300*16 {
		t.Errorf("the transcriber saw %d samples, want the fixture's 7.13 s", f.samples)
	}
}

// TestTranscribeEmpty: no segments is [], not null.
func TestTranscribeEmpty(t *testing.T) {
	var rec = send(handler(&fake{}), http.MethodPost, "/transcribe", wavFixture(t), nil)
	if rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != "[]" {
		t.Errorf("got %d %q", rec.Code, rec.Body.String())
	}
}

// TestTranscribeRefusals: not WAVE is a 400, over the cap a 413, a GET
// a 405, and the transcriber is not called for any of them.
func TestTranscribeRefusals(t *testing.T) {
	var big = append([]byte("RIFF\x00\x00\x00\x00WAVE"), make([]byte, maxWavBytes)...)
	for _, tc := range []struct {
		name   string
		method string
		body   []byte
		want   int
		says   string
	}{
		{
			name:   "not wave",
			method: http.MethodPost,
			body:   []byte("\x89PNG\r\n\x1a\nnot audio"),
			want:   http.StatusBadRequest,
			says:   "not a RIFF WAVE file",
		},
		{
			name:   "over the cap",
			method: http.MethodPost,
			body:   big,
			want:   http.StatusRequestEntityTooLarge,
			says:   "over",
		},
		{
			name:   "get",
			method: http.MethodGet,
			body:   nil,
			want:   http.StatusMethodNotAllowed,
			says:   "takes POST",
		},
	} {
		var (
			f   = &fake{}
			rec = send(handler(f), tc.method, "/transcribe", tc.body, nil)
		)
		if rec.Code != tc.want || !strings.Contains(rec.Body.String(), tc.says) {
			t.Errorf("%s: got %d %q, want %d saying %q", tc.name, rec.Code, rec.Body.String(), tc.want, tc.says)
		}
		if f.calls != 0 {
			t.Errorf("%s: the transcriber was called", tc.name)
		}
	}
}

// TestTranscribeFails: a failure is a 500 with the message, which the
// report prints as the why.
func TestTranscribeFails(t *testing.T) {
	var (
		f = &fake{
			err: errors.New("the model is not loaded"),
		}
		rec = send(handler(f), http.MethodPost, "/transcribe", wavFixture(t), nil)
	)
	if rec.Code != http.StatusInternalServerError || !strings.Contains(rec.Body.String(), "the model is not loaded") {
		t.Errorf("got %d %q", rec.Code, rec.Body.String())
	}
}

func TestHealthz(t *testing.T) {
	var rec = send(handler(&fake{}), http.MethodGet, "/healthz", nil, nil)
	if rec.Code != http.StatusOK || rec.Body.String() != "ok base.en\n" {
		t.Errorf("got %d %q", rec.Code, rec.Body.String())
	}
	if rec = send(handler(&fake{}), http.MethodPost, "/healthz", nil, nil); rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("POST got %d", rec.Code)
	}
}

// TestCORSPreflight: a preflight from a listed origin is a 204 with the
// headers, and reaches no route.
func TestCORSPreflight(t *testing.T) {
	var (
		f   = &fake{}
		rec = send(handler(f), http.MethodOptions, "/transcribe", nil, map[string]string{
			"Origin":                         "https://bff-main.tail1234.ts.net",
			"Access-Control-Request-Method":  http.MethodPost,
			"Access-Control-Request-Headers": "content-type",
		})
	)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	for k, want := range map[string]string{
		"Access-Control-Allow-Origin":  "https://bff-main.tail1234.ts.net",
		"Access-Control-Allow-Methods": http.MethodPost,
		"Access-Control-Allow-Headers": "Content-Type",
		"Vary":                         "Origin",
	} {
		if got := rec.Header().Get(k); got != want {
			t.Errorf("%s = %q, want %q", k, got, want)
		}
	}
	if f.calls != 0 {
		t.Errorf("the preflight reached the transcriber")
	}
}

// TestCORSAllowed: a POST from a listed origin is answered with the
// header on the answer.
func TestCORSAllowed(t *testing.T) {
	var rec = send(handler(&fake{}), http.MethodPost, "/transcribe", wavFixture(t), map[string]string{
		"Origin": "http://127.0.0.1:8080",
	})
	if rec.Code != http.StatusOK || rec.Header().Get("Access-Control-Allow-Origin") != "http://127.0.0.1:8080" {
		t.Errorf("got %d, header %q", rec.Code, rec.Header().Get("Access-Control-Allow-Origin"))
	}
}

// TestCORSRefused: a POST from another origin is a 403 before the body
// is read, and the transcriber is not called; a preflight from it too.
func TestCORSRefused(t *testing.T) {
	var (
		f     = &fake{}
		other = map[string]string{
			"Origin": "https://evil.example",
		}
	)
	for _, method := range []string{http.MethodPost, http.MethodOptions, http.MethodGet} {
		var rec = send(handler(f), method, "/transcribe", wavFixture(t), other)
		if rec.Code != http.StatusForbidden || !strings.Contains(rec.Body.String(), "evil.example") {
			t.Errorf("%s: got %d %q", method, rec.Code, rec.Body.String())
		}
		if rec.Header().Get("Access-Control-Allow-Origin") != "" {
			t.Errorf("%s: a refused origin got the header", method)
		}
	}
	if f.calls != 0 {
		t.Errorf("the transcriber was called for a refused origin")
	}
}

// TestNoOrigin: a request with no Origin, a curl, passes.
func TestNoOrigin(t *testing.T) {
	var rec = send(handler(&fake{}), http.MethodPost, "/transcribe", wavFixture(t), nil)
	if rec.Code != http.StatusOK {
		t.Errorf("got %d %q", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("a request with no Origin got the header")
	}
}

// TestDecodeRefused: a body that is RIFF WAVE on the outside and not
// audio inside is a 400, not a 500.
func TestDecodeRefused(t *testing.T) {
	var (
		f = &fake{}
		h = New(Config{
			Transcriber: f,
			Origins:     origins,
			Decode: func(context.Context, io.Reader) ([]float32, error) {
				return nil, errors.New("no data chunk")
			},
		})
		rec = send(h, http.MethodPost, "/transcribe", []byte("RIFF\x00\x00\x00\x00WAVEjunk"), nil)
	)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "no data chunk") {
		t.Errorf("got %d %q", rec.Code, rec.Body.String())
	}
}
