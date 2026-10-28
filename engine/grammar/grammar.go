// Package grammar is the one place calc.wasm is embedded. The compiled
// grammar is a build artifact of spec/calc.ohm (task calc:ohm2wasm). It
// has three consumers, the calc CLI, the js/wasm engine and the server
// bff, so it lives in a package and not beside each of them.
//
// Never hand-edit calc.wasm; change spec/calc.ohm and regenerate.
package grammar

import (
	"context"
	_ "embed"
	"fmt"

	"github.com/ohmjs/ohm-go/ohm"
)

//go:embed calc.wasm
var calcWasm []byte

// StartRule is the rule a parse enters: the first rule of calc.ohm.
const StartRule = "Exp"

// New returns a grammar over the embedded calc.wasm. The caller closes
// it.
//
// ctx must outlive every parse made through the returned grammar:
// ohm.Grammar stores it and uses it for each match. So it is a
// program's or a server's lifetime context, never a request's.
//
// An *ohm.Grammar is not safe for concurrent use: it holds the current
// input and the result stack. A caller that serves more than one caller
// needs one grammar per worker, or a lock.
func New(ctx context.Context) (*ohm.Grammar, error) {
	var (
		gmr *ohm.Grammar
		err error
	)
	if gmr, err = ohm.NewGrammar(ctx, calcWasm); err != nil {
		return nil, fmt.Errorf("loading grammar: %w", err)
	}
	return gmr, nil
}
