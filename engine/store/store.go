// Package store holds the engine's records behind the Storage
// interface. The wasm build has MemoryStore; bff has a file store of
// its own, in services/bff/store.go.
// docs/features/001-calculator/prd.md section 2.3.
package store

import (
	"slices"

	"github.com/adl-lang/adl-go/adl/sys/types"

	"engine/types/model"
)

// Storage is where the engine's Store lives between requests. The
// engine calls Load once, when it is made, and Save with the whole
// Store after each put and delete. A Save that fails leaves what Load
// would read as it was.
type Storage interface {
	Load() (model.Store, error)
	Save(s model.Store) error
}

// MemoryStore is a Storage in memory. It loses its changes when the
// program ends: in the browser, on reload.
type MemoryStore struct {
	store model.Store
}

// NewMemoryStore returns a MemoryStore that holds s.
func NewMemoryStore(s model.Store) *MemoryStore {
	return &MemoryStore{
		store: clone(s),
	}
}

// NewSeededStore returns a MemoryStore that holds Seed(), so the page
// opens with something to click.
func NewSeededStore() *MemoryStore {
	return NewMemoryStore(Seed())
}

// Load implements Storage.
func (m *MemoryStore) Load() (model.Store, error) {
	return clone(m.store), nil
}

// Save implements Storage.
func (m *MemoryStore) Save(s model.Store) error {
	m.store = clone(s)
	return nil
}

// clone copies the list, so a caller that changes its own copy does
// not change the store's.
func clone(s model.Store) model.Store {
	return model.MakeAll_Store(slices.Clone(s.Calculations))
}

// Seed is the three calculations the memory store starts with: the
// example's expression, a precedence case, and one that divides by
// zero.
func Seed() model.Store {
	var (
		example    = model.Make_Calculation("1", "the example", "(x + 3) * y")
		precedence = model.Make_Calculation("2", "precedence", "2 + 3 * 4")
		divide     = model.Make_Calculation("3", "division by zero", "10 / 0")
	)
	example.Bindings = []model.Binding{
		model.Make_Binding("x", 5),
		model.Make_Binding("y", 1),
	}
	precedence.Notes = types.Make_Maybe_just("Times binds tighter than plus: the value is 14, not 20.")
	divide.Base = model.Make_Base_hex()
	return model.MakeAll_Store([]model.Calculation{
		example,
		precedence,
		divide,
	})
}
