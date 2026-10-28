package lean

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/ardanlabs/kronk/sdk/bucky/model"

	"myw/source"
)

// fixture is the narration a test plays: testdata/narration.wav, 7.13 s of synthetic speech.
const fixture = "../testdata/narration.wav"

// open loads the model, or skips: the test needs the native libraries
// and a model, which `task myw:test` names through the environment.
func open(t *testing.T) *model.Model {
	t.Helper()
	var (
		libs = os.Getenv("PROTOWX_WHISPER_LIBS")
		mdl  = os.Getenv("PROTOWX_WHISPER_MODEL")
		m    *model.Model
		err  error
	)
	if libs == "" || mdl == "" {
		t.Skip("PROTOWX_WHISPER_LIBS and PROTOWX_WHISPER_MODEL are not set; run task myw:test")
	}
	if m, err = Open(context.Background(), source.Options{
		Libs:    libs,
		Model:   mdl,
		Threads: 2,
	}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = m.Unload(context.Background()) })
	return m
}

// TestTranscribe: the fixture's words come back, with times in order.
func TestTranscribe(t *testing.T) {
	var (
		m       = open(t)
		ctx     = context.Background()
		samples []float32
		tr      model.Transcription
		last    int64
		err     error
	)
	if samples, err = Decode(ctx, fixture); err != nil {
		t.Fatal(err)
	}
	if tr, err = m.Transcribe(ctx, samples, model.WithLanguage("en")); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(strings.ToLower(tr.Text), "the cell should move with the group") {
		t.Errorf("text got %q", tr.Text)
	}
	for _, s := range tr.Segments {
		if s.StartMs < last || s.EndMs < s.StartMs {
			t.Errorf("segment %d out of order: %d-%d after %d", s.Index, s.StartMs, s.EndMs, last)
		}
		last = s.EndMs
	}
}

// TestStream: the fixture fed in slices of 100 ms, as the page would
// post it, comes back as finals that hold the words, and the whole-span
// pass the close runs over the same samples gives the same words.
func TestStream(t *testing.T) {
	var (
		m           = open(t)
		ctx, cancel = context.WithTimeout(context.Background(), 2*time.Minute)
		samples     []float32
		stream      *model.Stream
		finals      []string
		whole       model.Transcription
		err         error
	)
	defer cancel()
	if samples, err = Decode(ctx, fixture); err != nil {
		t.Fatal(err)
	}
	if stream, err = m.NewStream(ctx, nil, model.WithStreamLanguage("en")); err != nil {
		t.Fatal(err)
	}
	go func() {
		var err error
		for at := 0; at < len(samples); at += 1600 {
			if err = stream.Feed(ctx, samples[at:min(at+1600, len(samples))]); err != nil {
				return
			}
		}
		_ = stream.Close()
	}()
	for ev := range stream.Events() {
		switch ev.Kind {
		case model.EventFinal:
			finals = append(finals, ev.Text)
		case model.EventError:
			t.Errorf("stream: %v", ev.Err)
		}
	}
	if got := strings.ToLower(strings.Join(finals, " ")); !strings.Contains(got, "should move with") {
		t.Errorf("finals got %q", finals)
	}
	if whole, err = m.Transcribe(ctx, samples, model.WithLanguage("en")); err != nil {
		t.Fatal(err)
	}
	if got := strings.ToLower(whole.Text); !strings.Contains(got, "should move with") {
		t.Errorf("the whole-span pass got %q", whole.Text)
	}
}
