// Package transcribecmd is `myw transcribe`: one WAV file in,
// its segments out, as `POST /transcribe` answers them
// (README.md).
package transcribecmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/ardanlabs/kronk/sdk/bucky/model"

	"myw/lean"
	"myw/server"
	"myw/source"
)

type TranscribeCmd struct {
	source.Options `opts:"mode=embedded"`

	Timeout time.Duration `help:"The most the transcription may take."`
	File    string        `opts:"mode=arg" help:"A WAV file; 16 kHz mono is read as it is, anything else is resampled."`
}

func NewTranscribeCmd() *TranscribeCmd {
	return &TranscribeCmd{
		Options: source.NewOptions(),
		Timeout: 10 * time.Minute,
	}
}

// Run loads the model, transcribes the file, and writes the segments as
// JSON on standard output, as the service answers them. The times go to
// standard error.
func (c *TranscribeCmd) Run() error {
	var (
		ctx, cancel = context.WithTimeout(context.Background(), c.Timeout)
		start       = time.Now()
		m           *model.Model
		samples     []float32
		tr          model.Transcription
		enc         = json.NewEncoder(os.Stdout)
		err         error
	)
	defer cancel()
	if m, err = lean.Open(ctx, c.Options); err != nil {
		return err
	}
	defer func() { _ = m.Unload(context.Background()) }()
	fmt.Fprintf(os.Stderr, "loaded in %s\n", source.Since(start))
	if samples, err = lean.Decode(ctx, c.File); err != nil {
		return err
	}
	start = time.Now()
	if tr, err = m.Transcribe(ctx, samples, model.WithLanguage("en")); err != nil {
		return fmt.Errorf("transcribe %s: %w", c.File, err)
	}
	fmt.Fprintf(os.Stderr, "transcribed %.2f s of audio in %s\n", float64(len(samples))/16000, source.Since(start))
	enc.SetIndent("", "  ")
	return enc.Encode(server.Segments(tr))
}
