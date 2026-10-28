// Package lean opens whisper.cpp with kronk's model package alone: no
// downloads, no llama, no catalog. The libraries come from a directory,
// the dev shell's whisper-cpp, and the model from a path or from the
// binary. It is the shape bff would take: kronk's transcription
// and streaming code with about 35 packages under it, against about 700
// for kronk's sdk/bucky with its download tools. README.md has the
// counts.
package lean

import (
	"context"
	"fmt"
	"os"

	"github.com/ardanlabs/bucky/pkg/whisper"
	"github.com/ardanlabs/kronk/sdk/bucky/model"

	"myw/source"
)

// Decode reads a WAV file as 16 kHz mono samples, resampling and
// downmixing what is not.
func Decode(ctx context.Context, path string) ([]float32, error) {
	var (
		f   *os.File
		out []float32
		err error
	)
	if f, err = os.Open(path); err != nil {
		return nil, err
	}
	defer f.Close()
	if out, err = model.Decode(ctx, f); err != nil {
		return nil, fmt.Errorf("decode %s: %w", path, err)
	}
	return out, nil
}

// Open loads whisper.cpp from libs and the model from o, and answers the
// model. Unload it when done.
func Open(ctx context.Context, o source.Options) (*model.Model, error) {
	var (
		path string
		m    *model.Model
		err  error
	)
	if o.Libs == "" {
		return nil, fmt.Errorf("lean: --libs is required; the dev shell's whisper-cpp has them")
	}
	if err = whisper.Load(o.Libs); err != nil {
		return nil, fmt.Errorf("load whisper.cpp from %s: %w", o.Libs, err)
	}
	if err = whisper.Init(o.Libs); err != nil {
		return nil, fmt.Errorf("init whisper.cpp from %s: %w", o.Libs, err)
	}
	if path, err = source.LocalModel(o); err != nil {
		return nil, err
	}
	fmt.Fprintf(os.Stderr, "model %s\n", path)
	// Two states in kronk's pool: a live stream holds one for its
	// lifetime, and the whole-span pass at its close, or a POST
	// /transcribe meanwhile, takes the other.
	if m, err = model.NewModel(ctx, model.NewConfig(
		model.WithModelPath(path),
		model.WithUseGPU(false),
		model.WithNThreads(o.Threads),
		model.WithNSeqMax(2),
	)); err != nil {
		return nil, fmt.Errorf("load the model %s: %w", path, err)
	}
	return m, nil
}
