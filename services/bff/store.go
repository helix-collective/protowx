package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/adl-lang/adl-go/adl"

	"engine/store"
	"engine/types/model"
)

// fileStore is the engine's store.Storage in one file, --store: a
// model.Store as ADL JSON. Load reads it at start; Save writes it whole
// on each put and delete. The engine holds the lock that serialises
// both. docs/features/001-calculator/prd.md section 2.3.
type fileStore struct {
	path   string
	decode adl.JsonDecodeBinder[model.Store]
	encode adl.JsonEncodeBinder[model.Store]
}

var _ store.Storage = (*fileStore)(nil)

func newFileStore(path string) *fileStore {
	return &fileStore{
		path:   path,
		decode: adl.CreateJsonDecodeBinding(model.Texpr_Store(), adl.RESOLVER),
		encode: adl.CreateJsonEncodeBinding(model.Texpr_Store(), adl.RESOLVER),
	}
}

// Load reads the file. A missing file is the seeded store, as the
// offline page has, and nothing is written until the first save. A file
// that does not decode is an error, and bff does not start.
func (f *fileStore) Load() (model.Store, error) {
	var (
		data []byte
		s    model.Store
		err  error
	)
	if data, err = os.ReadFile(f.path); err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return store.Seed(), nil
		}
		return model.Store{}, err
	}
	if err = f.decode.Decode(bytes.NewReader(data), &s); err != nil {
		return model.Store{}, fmt.Errorf("reading %s: %w", f.path, err)
	}
	return s, nil
}

// Save writes s whole: to a temporary file beside the store, then a
// rename over it. A save that fails leaves the file as it was.
func (f *fileStore) Save(s model.Store) error {
	var (
		compact  bytes.Buffer
		indented bytes.Buffer
		tmp      *os.File
		err      error
	)
	if err = f.encode.Encode(&compact, s); err != nil {
		return err
	}
	// Indented, so a person can read the file and a diff of it.
	if err = json.Indent(&indented, compact.Bytes(), "", "  "); err != nil {
		return err
	}
	indented.WriteByte('\n')
	if tmp, err = os.CreateTemp(filepath.Dir(f.path), filepath.Base(f.path)+".*"); err != nil {
		return err
	}
	defer func() { _ = os.Remove(tmp.Name()) }()
	// CreateTemp makes the file 0600; the store is an ordinary file.
	if err = tmp.Chmod(0o644); err != nil {
		_ = tmp.Close()
		return err
	}
	if _, err = tmp.Write(indented.Bytes()); err != nil {
		_ = tmp.Close()
		return err
	}
	if err = tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), f.path)
}
