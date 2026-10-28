package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/ohmjs/ohm-go/ohm"

	"engine/engine"
	"engine/grammar"
	"engine/store"
)

// maxRequestBytes caps a request body. A request carries one
// calculation, so the cap is far more than any page sends, and it is
// what stands between the server and an arbitrary allocation.
const maxRequestBytes = 1 << 20 // 1 MiB

// engineHandler serves POST /api/calc from one engine. The mutex gives
// the engine the single-threaded world it is written for:
// engine.Engine holds the store in memory, and *ohm.Grammar holds the
// current input and the result stack, so neither tolerates a second
// goroutine.
//
// Single-tenant, deliberately. One engine is one store, shared by every
// caller: any caller can read, change or delete any calculation. That
// is safe on loopback and nowhere else, which is why rootCmd.Addr
// defaults to 127.0.0.1. Sessions come before this listener binds any
// wider.
type engineHandler struct {
	mu  sync.Mutex
	eng *engine.Engine
	gmr *ohm.Grammar
}

// newEngineHandler builds the grammar, and the engine over it and
// storage.
//
// ctx is the server's lifetime context, never a request's: ohm.Grammar
// stores the context it is given and matches under it, so a request's
// context would cancel every parse made after that request ended.
func newEngineHandler(ctx context.Context, storage store.Storage) (*engineHandler, error) {
	var (
		gmr *ohm.Grammar
		eng *engine.Engine
		err error
	)
	if gmr, err = grammar.New(ctx); err != nil {
		return nil, err
	}
	if eng, err = engine.New(gmr, storage); err != nil {
		_ = gmr.Close()
		return nil, err
	}
	return &engineHandler{
		eng: eng,
		gmr: gmr,
	}, nil
}

// Close releases the grammar's wazero runtime.
func (h *engineHandler) Close() error {
	return h.gmr.Close()
}

// ServeHTTP answers one request: the ADL JSON request body in, the ADL
// JSON response body out.
//
// An engine error is a 200. The protocol's error branch is a value, not
// an HTTP failure, so the page shows the same error whether it talks to
// the worker or to this handler. The only non-200s mean the transport
// failed, which is how the page tells "the text does not parse" from
// "you are not connected".
func (h *engineHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var (
		body    []byte
		tooBig  *http.MaxBytesError
		payload string
		took    handled
		err     error
	)
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		httpError(w, http.StatusMethodNotAllowed, "the engine API takes POST")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBytes)
	if body, err = io.ReadAll(r.Body); err != nil {
		if errors.As(err, &tooBig) {
			httpError(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("request body over %d bytes", maxRequestBytes))
			return
		}
		httpError(w, http.StatusBadRequest, "reading the request body: "+err.Error())
		return
	}
	payload, took = h.handle(string(body))
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	// Where the server's share of the round trip went, for the page's
	// feedback report: the wait for the engine's lock, then the engine.
	w.Header().Set("Server-Timing", took.header())
	_, _ = io.WriteString(w, payload)
}

// handled is the time one request spent waiting for the lock and in the
// engine.
type handled struct {
	lock   time.Duration
	engine time.Duration
}

// header writes it as a Server-Timing value, in milliseconds.
func (t handled) header() string {
	return fmt.Sprintf("lock;dur=%.3f, engine;dur=%.3f", ms(t.lock), ms(t.engine))
}

func ms(d time.Duration) float64 {
	return float64(d) / float64(time.Millisecond)
}

// handle is the locked call, in a method of its own so that the lock is
// released before the response reaches the socket: a slow reader must
// not hold the engine.
func (h *engineHandler) handle(body string) (string, handled) {
	var (
		asked = time.Now()
		begun time.Time
		out   string
	)
	h.mu.Lock()
	defer h.mu.Unlock()
	begun = time.Now()
	out = h.eng.HandleJSON(body)
	return out, handled{
		lock:   begun.Sub(asked),
		engine: time.Since(begun),
	}
}

// httpError writes a transport failure as plain text. It is never a
// protocol message: a client that gets one has no Response to decode.
func httpError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	fmt.Fprintln(w, message)
}
