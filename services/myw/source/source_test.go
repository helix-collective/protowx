package source

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

// TestWriteEmbedded: the model in the binary reaches the cache once,
// whole, under its hash; a second call writes nothing.
func TestWriteEmbedded(t *testing.T) {
	var (
		dir   = t.TempDir()
		saved = embedded
		first string
		again string
		info  os.FileInfo
		data  []byte
		err   error
	)
	t.Cleanup(func() { embedded = saved })
	embedded = []byte("a model")
	if first, err = writeEmbedded(dir); err != nil {
		t.Fatal(err)
	}
	if filepath.Dir(first) != dir || filepath.Ext(first) != ".bin" {
		t.Errorf("path got %q", first)
	}
	if data, err = os.ReadFile(first); err != nil || !bytes.Equal(data, embedded) {
		t.Fatalf("content got %q, %v", data, err)
	}
	if info, err = os.Stat(first); err != nil {
		t.Fatal(err)
	}
	if again, err = writeEmbedded(dir); err != nil || again != first {
		t.Fatalf("second call got %q, %v", again, err)
	}
	if after, _ := os.Stat(first); !after.ModTime().Equal(info.ModTime()) {
		t.Errorf("the second call wrote the file again")
	}
	if entries, _ := os.ReadDir(dir); len(entries) != 1 {
		t.Errorf("left %d files; want the model alone", len(entries))
	}
}

// TestLocalModel: --model wins; with no model in the binary and none
// named, it says so.
func TestLocalModel(t *testing.T) {
	var (
		saved = embedded
		got   string
		err   error
	)
	t.Cleanup(func() { embedded = saved })
	embedded = nil
	if got, err = LocalModel(Options{
		Model: "/m.bin",
	}); err != nil || got != "/m.bin" {
		t.Errorf("got %q, %v", got, err)
	}
	if _, err = LocalModel(Options{}); err == nil {
		t.Errorf("no model: got no error")
	}
}
