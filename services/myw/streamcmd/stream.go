// Package streamcmd is `myw stream`: a WAV file fed to a
// bucky stream in slices, as a microphone would feed it, with each
// partial and final printed as it arrives. It is the server half of
// live caption (README.md),
// with the file standing in for the page.
package streamcmd

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/ardanlabs/kronk/sdk/bucky/model"

	"myw/lean"
	"myw/source"
)

type StreamCmd struct {
	source.Options `opts:"mode=embedded"`

	SliceMs   int    `help:"Milliseconds of audio in each feed, as the page would post them."`
	PartialMs int    `help:"How often the stream decodes a partial."`
	Fast      bool   `help:"Feed as fast as the stream takes it, not in real time."`
	File      string `opts:"mode=arg" help:"A WAV file to play into the stream."`
}

func NewStreamCmd() *StreamCmd {
	return &StreamCmd{
		Options:   source.NewOptions(),
		SliceMs:   100,
		PartialMs: 700,
	}
}

// Run plays the file into a stream and prints its events. A line reads
// the wall time since the feed began, the kind, the audio span and the
// text: the wall time against the span's end is the lag a user sees.
func (c *StreamCmd) Run() error {
	var (
		ctx     = context.Background()
		m       *model.Model
		samples []float32
		stream  *model.Stream
		slice   int
		begun   time.Time
		done    = make(chan struct{})
		err     error
	)
	if m, err = lean.Open(ctx, c.Options); err != nil {
		return err
	}
	defer func() { _ = m.Unload(context.Background()) }()
	if samples, err = lean.Decode(ctx, c.File); err != nil {
		return err
	}
	if stream, err = m.NewStream(ctx, nil,
		model.WithStreamLanguage("en"),
		model.WithPartialEveryMs(c.PartialMs),
	); err != nil {
		return fmt.Errorf("new stream: %w", err)
	}
	begun = time.Now()
	go func() {
		defer close(done)
		for ev := range stream.Events() {
			var kind string
			switch ev.Kind {
			case model.EventPartial:
				kind = "partial"
			case model.EventFinal:
				kind = "final  "
			case model.EventError:
				fmt.Fprintf(os.Stderr, "error: %v\n", ev.Err)
				continue
			default:
				continue
			}
			fmt.Printf("%6.2fs %s %5d-%5dms %s\n", time.Since(begun).Seconds(), kind, ev.StartMs, ev.EndMs, ev.Text)
		}
	}()
	slice = c.SliceMs * 16
	for at := 0; at < len(samples); at += slice {
		var end = min(at+slice, len(samples))
		if err = stream.Feed(ctx, samples[at:end]); err != nil {
			return fmt.Errorf("feed: %w", err)
		}
		if !c.Fast {
			time.Sleep(begun.Add(time.Duration(end) * time.Second / 16000).Sub(time.Now()))
		}
	}
	fmt.Printf("%6.2fs fed %.2f s of audio; closing\n", time.Since(begun).Seconds(), float64(len(samples))/16000)
	if err = stream.Close(); err != nil {
		return fmt.Errorf("close: %w", err)
	}
	<-done
	return nil
}
