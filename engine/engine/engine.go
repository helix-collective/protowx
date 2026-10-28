// Package engine answers the protocol of spec/api.adl, package api: one
// request in, one response out. It parses with package ast, evaluates
// with package eval, and keeps the records in a store.Storage. It knows
// nothing about where a request comes from: wasm/main.go wires it to a
// Web Worker, and services/bff to POST /api/calc.
// docs/features/001-calculator/prd.md section 2.
//
// Every value that crosses goes through the adl-go JSON bindings;
// encoding/json does not round-trip the generated union types.
package engine

import (
	"bytes"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/adl-lang/adl-go/adl"
	"github.com/adl-lang/adl-go/adl/sys/types"
	"github.com/ohmjs/ohm-go/ohm"

	"engine/ast"
	"engine/eval"
	"engine/store"
	"engine/types/api"
	"engine/types/calc"
	"engine/types/model"
)

// Engine holds the store and answers requests one at a time.
//
// It is not safe for concurrent use. It holds the store in memory, and
// *ohm.Grammar holds the current input and the result stack. A worker
// is single-threaded; an HTTP transport holds a lock around each call.
type Engine struct {
	gmr     *ohm.Grammar
	storage store.Storage
	// store is the engine's copy of what storage holds. A put or a
	// delete changes it only after storage has saved the change.
	store  model.Store
	decode adl.JsonDecodeBinder[api.Request]
	encode adl.JsonEncodeBinder[api.Response]
}

// New returns an engine over gmr, a grammar from package grammar, and
// the store that storage loads. A store that does not load is an
// error: the engine never starts on a store it cannot read.
func New(gmr *ohm.Grammar, storage store.Storage) (*Engine, error) {
	var (
		s   model.Store
		err error
	)
	if s, err = storage.Load(); err != nil {
		return nil, fmt.Errorf("loading the store: %w", err)
	}
	return &Engine{
		gmr:     gmr,
		storage: storage,
		store:   s,
		decode:  adl.CreateJsonDecodeBinding(api.Texpr_Request(), adl.RESOLVER),
		encode:  adl.CreateJsonEncodeBinding(api.Texpr_Response(), adl.RESOLVER),
	}, nil
}

// HandleJSON is Handle over the wire format: one Request as ADL JSON
// in, one Response as ADL JSON out. A request that does not decode gets
// an error response; a response that does not encode, which would be a
// bug, gets an error response that says so.
func (e *Engine) HandleJSON(request string) string {
	var (
		req  api.Request
		resp api.Response
		buf  bytes.Buffer
		err  error
	)
	if err = e.decode.Decode(strings.NewReader(request), &req); err != nil {
		resp = errorResponse("decoding the request: " + err.Error())
	} else {
		resp = e.Handle(req)
	}
	if err = e.encode.Encode(&buf, resp); err != nil {
		buf.Reset()
		_ = e.encode.Encode(&buf, errorResponse("encoding the response: "+err.Error()))
	}
	return buf.String()
}

// Handle answers one request. Every failure is an error response;
// Handle itself never fails.
func (e *Engine) Handle(req api.Request) api.Response {
	var (
		resp api.Response
		err  error
	)
	if resp, err = api.HandleWithErr_Request(
		req,
		e.list,
		e.get,
		e.put,
		e.delete,
		e.parse,
		e.evaluate,
		func() (api.Response, error) {
			return api.Response{}, fmt.Errorf("unexpected request branch %T", req.Branch)
		},
	); err != nil {
		return toResponse(err)
	}
	return resp
}

// ErrNoCalculation is a get or a delete of an id the store does not
// hold.
var ErrNoCalculation = errors.New("no calculation")

func (e *Engine) list(struct{}) (api.Response, error) {
	return api.Make_Response_list(slices.Clone(e.store.Calculations)), nil
}

func (e *Engine) get(id model.CalculationId) (api.Response, error) {
	var i = e.index(id)
	if i < 0 {
		return api.Response{}, fmt.Errorf("%w %q", ErrNoCalculation, id)
	}
	return api.Make_Response_got(e.store.Calculations[i]), nil
}

// put creates a calculation when its id is empty, and gives it the next
// free id. Otherwise it replaces the calculation with that id, or adds
// it at the end when there is none.
func (e *Engine) put(c model.Calculation) (api.Response, error) {
	var (
		next = slices.Clone(e.store.Calculations)
		i    int
		err  error
	)
	if c.Bindings == nil {
		c.Bindings = []model.Binding{}
	}
	if c.Id == "" {
		c.Id = e.nextId()
	}
	if i = e.index(c.Id); i < 0 {
		next = append(next, c)
	} else {
		next[i] = c
	}
	if err = e.save(next); err != nil {
		return api.Response{}, err
	}
	return api.Make_Response_put(c), nil
}

func (e *Engine) delete(id model.CalculationId) (api.Response, error) {
	var (
		i   = e.index(id)
		err error
	)
	if i < 0 {
		return api.Response{}, fmt.Errorf("%w %q", ErrNoCalculation, id)
	}
	if err = e.save(slices.Delete(slices.Clone(e.store.Calculations), i, i+1)); err != nil {
		return api.Response{}, err
	}
	return api.Make_Response_deleted(id), nil
}

// save hands the whole list to storage, and takes it as the engine's
// copy only when the save succeeds. A save that fails leaves the
// engine's copy as storage still has it.
func (e *Engine) save(calculations []model.Calculation) error {
	var (
		next = model.MakeAll_Store(calculations)
		err  error
	)
	if err = e.storage.Save(next); err != nil {
		return fmt.Errorf("saving the store: %w", err)
	}
	e.store = next
	return nil
}

func (e *Engine) parse(text string) (api.Response, error) {
	var (
		exp calc.Exp
		err error
	)
	if exp, err = ast.Parse(e.gmr, text); err != nil {
		return api.Response{}, err
	}
	return api.Make_Response_parsed(api.Make_ParseResp(exp, ast.Print(exp))), nil
}

func (e *Engine) evaluate(req api.EvaluateReq) (api.Response, error) {
	var (
		env = eval.Env{}
		exp calc.Exp
		v   int64
		err error
	)
	// A name bound twice takes its last value.
	for _, b := range req.Bindings {
		env[b.Name] = b.Value
	}
	if exp, err = ast.Parse(e.gmr, req.Text); err != nil {
		return api.Response{}, err
	}
	if v, err = eval.Eval(exp, env); err != nil {
		return api.Response{}, err
	}
	return api.Make_Response_evaluated(api.Make_EvaluateResp(v, ast.Print(exp))), nil
}

// index is the place of id in the store, or -1.
func (e *Engine) index(id model.CalculationId) int {
	return slices.IndexFunc(e.store.Calculations, func(c model.Calculation) bool {
		return c.Id == id
	})
}

// nextId is one more than the largest id that is a decimal number, so
// an id is never given twice while its calculation is in the store.
func (e *Engine) nextId() model.CalculationId {
	var (
		top int64
		n   int64
		err error
	)
	for _, c := range e.store.Calculations {
		if n, err = strconv.ParseInt(string(c.Id), 10, 64); err == nil && n > top {
			top = n
		}
	}
	return model.CalculationId(strconv.FormatInt(top+1, 10))
}

// toResponse is the error branch for err. A parse error carries where
// in the text it is.
func toResponse(err error) api.Response {
	var (
		perr *ast.ParseError
		at   = types.Make_Maybe_nothing[api.Position]()
	)
	if errors.As(err, &perr) {
		at = types.Make_Maybe_just(api.Make_Position(int32(perr.Line), int32(perr.Column)))
	}
	return api.Make_Response_error(api.Make_Error(err.Error(), at))
}

func errorResponse(message string) api.Response {
	return api.Make_Response_error(api.Make_Error(message, types.Make_Maybe_nothing[api.Position]()))
}
