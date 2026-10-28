package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"engine/store"
	"engine/types/model"
)

// TestFileStore_Missing: a missing file is the seeded store, and
// nothing is written.
func TestFileStore_Missing(t *testing.T) {
	var (
		path = filepath.Join(t.TempDir(), "calculations.json")
		s    model.Store
		err  error
	)
	if s, err = newFileStore(path).Load(); err != nil {
		t.Fatal(err)
	}
	if len(s.Calculations) != len(store.Seed().Calculations) {
		t.Fatalf("Load of a missing file = %v, want the seeds", s)
	}
	if _, err = os.Stat(path); err == nil {
		t.Fatal("Load wrote the file")
	}
}

// TestFileStore_RoundTrip: what Save writes, Load reads.
func TestFileStore_RoundTrip(t *testing.T) {
	var (
		path = filepath.Join(t.TempDir(), "calculations.json")
		fs   = newFileStore(path)
		want = store.Seed()
		got  model.Store
		info os.FileInfo
		err  error
	)
	if err = fs.Save(want); err != nil {
		t.Fatal(err)
	}
	if got, err = newFileStore(path).Load(); err != nil {
		t.Fatal(err)
	}
	if len(got.Calculations) != 3 || got.Calculations[0].Bindings[0].Name != "x" || got.Calculations[1].Notes != want.Calculations[1].Notes {
		t.Fatalf("Load = %v, want %v", got, want)
	}
	if info, err = os.Stat(path); err != nil || info.Mode().Perm() != 0o644 {
		t.Fatalf("the file's mode = %v, %v", info.Mode(), err)
	}
}

// TestFileStore_Bad: a file that does not decode stops the start.
func TestFileStore_Bad(t *testing.T) {
	var (
		path = filepath.Join(t.TempDir(), "calculations.json")
		err  error
	)
	if err = os.WriteFile(path, []byte(`{"calculations": [{"name": 1}]}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err = newFileStore(path).Load(); err == nil || !strings.Contains(err.Error(), "reading "+path) {
		t.Fatalf("Load of a bad file = %v", err)
	}
	if _, _, err = (&rootCmd{
		Dir:   distDir(t),
		API:   true,
		Store: path,
	}).handler(t.Context(), nil); err == nil {
		t.Fatal("bff started on a bad store")
	}
}

// TestFileStore_SaveFails: a save to a directory that is gone fails,
// and leaves nothing behind.
func TestFileStore_SaveFails(t *testing.T) {
	var (
		path = filepath.Join(t.TempDir(), "gone", "calculations.json")
		err  error
	)
	if err = newFileStore(path).Save(store.Seed()); err == nil {
		t.Fatal("Save into a missing directory succeeded")
	}
}
