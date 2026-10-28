package server

import (
	"context"
	"sync"

	"github.com/ardanlabs/kronk/sdk/bucky/model"

	"myw/lean"
	"myw/source"
)

// Model is the real Transcriber and Streamer: whisper.cpp through
// lean.Open. It loads the model at the first call, not at startup, and
// keeps it: a service that is never asked never loads it. One
// transcription runs at a time, behind the one mutex, so the load and
// the calls never overlap. A live stream holds a state of kronk's pool
// for its lifetime and decodes on its own goroutine; lean.Open sizes the
// pool at two, so a stream and a whole-file pass do not wait on each
// other.
type Model struct {
	opts source.Options
	mu   sync.Mutex
	m    *model.Model
}

func NewModel(o source.Options) *Model {
	return &Model{
		opts: o,
	}
}

// Transcribe loads the model when it is not loaded, then transcribes
// samples as English.
func (t *Model) Transcribe(ctx context.Context, samples []float32) ([]Segment, error) {
	var (
		tr  model.Transcription
		err error
	)
	t.mu.Lock()
	defer t.mu.Unlock()
	if err = t.load(); err != nil {
		return nil, err
	}
	if tr, err = t.m.Transcribe(ctx, samples, model.WithLanguage("en")); err != nil {
		return nil, err
	}
	return Segments(tr), nil
}

// load opens the model when it is not open. The caller holds the mutex.
func (t *Model) load() error {
	var err error
	if t.m != nil {
		return nil
	}
	// A background context: a request that goes away mid-load must not
	// leave half a model behind for the next one.
	if t.m, err = lean.Open(context.Background(), t.opts); err != nil {
		return err
	}
	return nil
}

// NewStream opens a live stream on the model, English, with a partial
// every partialEveryMs.
func (t *Model) NewStream(ctx context.Context) (Stream, error) {
	var (
		s   *model.Stream
		err error
	)
	t.mu.Lock()
	defer t.mu.Unlock()
	if err = t.load(); err != nil {
		return nil, err
	}
	if s, err = t.m.NewStream(ctx, nil,
		model.WithStreamLanguage("en"),
		model.WithPartialEveryMs(partialEveryMs),
	); err != nil {
		return nil, err
	}
	return s, nil
}

// Close unloads the model, if it was loaded.
func (t *Model) Close() error {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.m == nil {
		return nil
	}
	defer func() { t.m = nil }()
	return t.m.Unload(context.Background())
}
