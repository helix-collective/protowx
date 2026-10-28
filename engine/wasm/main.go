//go:build js && wasm

// Command wasm is the engine as a js/wasm program. It loads the
// embedded grammar once, makes an engine over the seeded memory store,
// publishes calcRequest on the JavaScript global and blocks. The page's
// worker, in web/packages/client, runs it.
//
//	calcRequest(requestJson: string): string  // an api.Response as ADL JSON
//
// Build with task calc:wasm, which also copies the Go toolchain's
// wasm_exec.js beside the binary. The memory store loses its changes
// on reload. docs/features/001-calculator/prd.md section 2.3.
package main

import (
	"context"
	"fmt"
	"os"
	"syscall/js"

	"github.com/ohmjs/ohm-go/ohm"

	"engine/engine"
	"engine/grammar"
	"engine/store"
)

func main() {
	var (
		gmr *ohm.Grammar
		eng *engine.Engine
		err error
	)
	if gmr, err = grammar.New(context.Background()); err != nil {
		fmt.Fprintf(os.Stderr, "%v\n", err)
		os.Exit(1)
	}
	// The grammar lives as long as the worker does; there is no Close.
	if eng, err = engine.New(gmr, store.NewSeededStore()); err != nil {
		fmt.Fprintf(os.Stderr, "%v\n", err)
		os.Exit(1)
	}
	js.Global().Set("calcRequest", js.FuncOf(func(_ js.Value, args []js.Value) any {
		if len(args) != 1 {
			return eng.HandleJSON(`{"invalid": null}`)
		}
		return eng.HandleJSON(args[0].String())
	}))
	select {}
}
