// Package source says where the two native parts come from: the
// whisper.cpp libraries and the model. It imports nothing of kronk:
// a package that does cannot start without libffi (README.md), and this
// one is tested without it.
//
//   - the model: --model, a path on disk; else the model built into the
//     binary with `-tags embedmodel` (embed.go), written once to the
//     cache under its SHA-256.
//   - the libraries: --libs, a directory that holds them; the dev shell
//     exports it as PROTOWX_WHISPER_LIBS.
package source

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Options says where the libraries and the model come from. The
// commands embed it, so its fields are their flags.
type Options struct {
	Libs    string `opts:"env=PROTOWX_WHISPER_LIBS" help:"Directory of whisper.cpp's libraries: the dev shell's whisper-cpp, which it exports as PROTOWX_WHISPER_LIBS."`
	Model   string `opts:"short=m" help:"A ggml whisper model on disk. Empty is the model built in with -tags embedmodel."`
	Cache   string `help:"Directory the built-in model is written to once. Empty is the user cache, protowx/whisper."`
	Threads int32  `help:"Threads for the decode. More is not faster on a busy machine: whisper.cpp's OpenMP threads spin while they wait; see README.md."`
}

// NewOptions carries the defaults.
func NewOptions() Options {
	return Options{
		Threads: 2,
	}
}

// EmbeddedName is the model `task myw:model` downloads for
// `-tags embedmodel`, as /healthz names it.
const EmbeddedName = "base.en"

// Embedded reports whether the binary carries a model.
func Embedded() bool {
	return len(embedded) > 0
}

// ModelName is the model's name for a log line or /healthz: the file's
// name without `ggml-` and `.bin` for --model, else the built-in one.
func ModelName(o Options) string {
	if o.Model == "" {
		return EmbeddedName
	}
	return strings.TrimSuffix(strings.TrimPrefix(filepath.Base(o.Model), "ggml-"), ".bin")
}

// LocalModel is the model to load: --model, or the embedded model
// written to the cache.
func LocalModel(o Options) (string, error) {
	switch {
	case o.Model != "":
		return o.Model, nil
	case len(embedded) > 0:
		return writeEmbedded(o.Cache)
	}
	return "", errors.New("no model: this binary has none built in; pass --model")
}

// writeEmbedded writes the embedded model to dir under its SHA-256, once,
// and answers the path. kronk's model package reads a model from a file,
// not from memory, so the bytes in the binary have to reach the disk. A
// second run finds the file and writes nothing.
func writeEmbedded(dir string) (string, error) {
	var (
		sum  = sha256.Sum256(embedded)
		name = "ggml-" + hex.EncodeToString(sum[:8]) + ".bin"
		path string
		tmp  *os.File
		err  error
	)
	if dir == "" {
		if dir, err = os.UserCacheDir(); err != nil {
			return "", err
		}
		dir = filepath.Join(dir, "protowx", "whisper")
	}
	path = filepath.Join(dir, name)
	if _, err = os.Stat(path); err == nil {
		return path, nil
	}
	if err = os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	// A temporary name, then a rename: a second process never reads half
	// a model.
	if tmp, err = os.CreateTemp(dir, name+".*"); err != nil {
		return "", err
	}
	if _, err = tmp.Write(embedded); err != nil {
		_ = tmp.Close()
		_ = os.Remove(tmp.Name())
		return "", err
	}
	if err = tmp.Close(); err != nil {
		_ = os.Remove(tmp.Name())
		return "", err
	}
	if err = os.Rename(tmp.Name(), path); err != nil {
		return "", err
	}
	return path, nil
}

// Since is the time since start, rounded to the millisecond, for a report line.
func Since(start time.Time) time.Duration {
	return time.Since(start).Round(time.Millisecond)
}
