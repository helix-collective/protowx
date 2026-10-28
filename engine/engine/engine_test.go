package engine

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/ohmjs/ohm-go/ohm"

	"engine/grammar"
	"engine/store"
	"engine/types/api"
	"engine/types/model"
)

func newEngine(t *testing.T, storage store.Storage) *Engine {
	t.Helper()
	var (
		gmr *ohm.Grammar
		eng *Engine
		err error
	)
	if gmr, err = grammar.New(context.Background()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		gmr.Close()
	})
	if eng, err = New(gmr, storage); err != nil {
		t.Fatal(err)
	}
	return eng
}

// errorOf is the message of an error response, or fails the test.
func errorOf(t *testing.T, resp api.Response) api.Error {
	t.Helper()
	var (
		e  api.Error
		ok bool
	)
	if e, ok = resp.Cast_error(); !ok {
		t.Fatalf("got %#v, want an error", resp.Branch)
	}
	return e
}

func TestList(t *testing.T) {
	var (
		eng  = newEngine(t, store.NewSeededStore())
		list []model.Calculation
		ok   bool
	)
	if list, ok = eng.Handle(api.Make_Request_list()).Cast_list(); !ok {
		t.Fatal("list: not a list")
	}
	if len(list) != 3 || list[0].Text != "(x + 3) * y" {
		t.Fatalf("list = %v, want the three seeds", list)
	}
}

func TestGet(t *testing.T) {
	var (
		eng = newEngine(t, store.NewSeededStore())
		got model.Calculation
		ok  bool
	)
	if got, ok = eng.Handle(api.Make_Request_get("2")).Cast_got(); !ok {
		t.Fatal("get 2: not got")
	}
	if got.Name != "precedence" {
		t.Fatalf("get 2 = %v", got)
	}
	if e := errorOf(t, eng.Handle(api.Make_Request_get("9"))); e.Message != `no calculation "9"` {
		t.Fatalf("get 9 = %q", e.Message)
	}
}

// TestPutCreates: a put with an empty id makes one, saved, and the
// response carries it.
func TestPutCreates(t *testing.T) {
	var (
		mem    = store.NewSeededStore()
		eng    = newEngine(t, mem)
		put    model.Calculation
		saved  model.Store
		ok     bool
		err    error
		second model.Calculation
	)
	if put, ok = eng.Handle(api.Make_Request_put(model.Make_Calculation("", "new", "1 + 1"))).Cast_put(); !ok {
		t.Fatal("put: not put")
	}
	if put.Id != "4" {
		t.Fatalf("put made id %q, want 4", put.Id)
	}
	if saved, err = mem.Load(); err != nil {
		t.Fatal(err)
	}
	if len(saved.Calculations) != 4 || saved.Calculations[3].Id != "4" {
		t.Fatalf("saved = %v", saved)
	}
	if second, ok = eng.Handle(api.Make_Request_put(model.Make_Calculation("", "next", "2"))).Cast_put(); !ok || second.Id != "5" {
		t.Fatalf("second put = %v, want id 5", second)
	}
}

func TestPutUpdates(t *testing.T) {
	var (
		mem   = store.NewSeededStore()
		eng   = newEngine(t, mem)
		saved model.Store
		err   error
		c     = model.Make_Calculation("2", "renamed", "2 * 3 + 4")
	)
	if _, ok := eng.Handle(api.Make_Request_put(c)).Cast_put(); !ok {
		t.Fatal("put: not put")
	}
	if saved, err = mem.Load(); err != nil {
		t.Fatal(err)
	}
	if len(saved.Calculations) != 3 || saved.Calculations[1].Name != "renamed" {
		t.Fatalf("saved = %v", saved)
	}
}

func TestDelete(t *testing.T) {
	var (
		mem   = store.NewSeededStore()
		eng   = newEngine(t, mem)
		id    model.CalculationId
		saved model.Store
		ok    bool
		err   error
	)
	if id, ok = eng.Handle(api.Make_Request_delete("1")).Cast_deleted(); !ok || id != "1" {
		t.Fatalf("delete 1 = %v", id)
	}
	if saved, err = mem.Load(); err != nil {
		t.Fatal(err)
	}
	if len(saved.Calculations) != 2 || saved.Calculations[0].Id != "2" {
		t.Fatalf("saved = %v", saved)
	}
}

// TestDeleteUnknown: a delete of an unknown id is an error, and the
// store is as it was.
func TestDeleteUnknown(t *testing.T) {
	var (
		eng  = newEngine(t, store.NewSeededStore())
		e    = errorOf(t, eng.Handle(api.Make_Request_delete("nine")))
		list []model.Calculation
	)
	if e.Message != `no calculation "nine"` {
		t.Fatalf("delete nine = %q", e.Message)
	}
	if _, ok := e.At.Cast_nothing(); !ok {
		t.Fatal("a store error has a position")
	}
	list, _ = eng.Handle(api.Make_Request_list()).Cast_list()
	if len(list) != 3 {
		t.Fatalf("list = %d calculations, want 3", len(list))
	}
}

func TestParse(t *testing.T) {
	var (
		eng = newEngine(t, store.NewSeededStore())
		p   api.ParseResp
		ok  bool
	)
	if p, ok = eng.Handle(api.Make_Request_parse("(x + 3) * y - 10 / 2")).Cast_parsed(); !ok {
		t.Fatal("parse: not parsed")
	}
	if p.Printed != "(((x + 3) * y) - (10 / 2))" {
		t.Fatalf("printed = %q", p.Printed)
	}
}

// TestParseError: a parse error carries its line and column.
func TestParseError(t *testing.T) {
	var (
		eng = newEngine(t, store.NewSeededStore())
		e   = errorOf(t, eng.Handle(api.Make_Request_parse("1 + * 2")))
		at  api.Position
		ok  bool
	)
	if at, ok = e.At.Cast_just(); !ok {
		t.Fatalf("parse error %q has no position", e.Message)
	}
	if at.Line != 1 || at.Column != 5 {
		t.Fatalf("at = %d:%d, want 1:5", at.Line, at.Column)
	}
	if !strings.HasPrefix(e.Message, "Line 1, col 5:") {
		t.Fatalf("message = %q", e.Message)
	}
}

func TestEvaluate(t *testing.T) {
	var (
		eng = newEngine(t, store.NewSeededStore())
		v   api.EvaluateResp
		ok  bool
	)
	if v, ok = eng.Handle(api.Make_Request_evaluate(api.Make_EvaluateReq("(x + 3) * y", []model.Binding{
		model.Make_Binding("x", 5),
		model.Make_Binding("y", 1),
	}))).Cast_evaluated(); !ok {
		t.Fatal("evaluate: not evaluated")
	}
	if v.Value != 8 || v.Printed != "((x + 3) * y)" {
		t.Fatalf("evaluated = %d, %q", v.Value, v.Printed)
	}
}

// TestEvaluateErrors: an evaluation error is the evaluator's message,
// with no position.
func TestEvaluateErrors(t *testing.T) {
	var (
		eng   = newEngine(t, store.NewSeededStore())
		cases = []struct {
			text string
			want string
		}{
			{
				text: "x + 1",
				want: "unknown variable x",
			},
			{
				text: "10 / 0",
				want: "division by zero: 10 / 0",
			},
			{
				text: "9223372036854775807 + 1",
				want: "the value overflows",
			},
		}
	)
	for _, c := range cases {
		t.Run(c.text, func(t *testing.T) {
			var e = errorOf(t, eng.Handle(api.Make_Request_evaluate(api.Make_EvaluateReq(c.text, nil))))
			if e.Message != c.want {
				t.Fatalf("message = %q, want %q", e.Message, c.want)
			}
			if _, ok := e.At.Cast_nothing(); !ok {
				t.Fatal("an evaluation error has a position")
			}
		})
	}
}

// failing is a Storage whose Save fails.
type failing struct {
	store.MemoryStore
}

func (f *failing) Save(model.Store) error {
	return errors.New("the disk is full")
}

// TestSaveFails: a write that fails is an error response, and the
// engine's copy is as it was.
func TestSaveFails(t *testing.T) {
	var (
		eng  = newEngine(t, &failing{*store.NewSeededStore()})
		e    = errorOf(t, eng.Handle(api.Make_Request_put(model.Make_Calculation("", "new", "1"))))
		list []model.Calculation
	)
	if e.Message != "saving the store: the disk is full" {
		t.Fatalf("message = %q", e.Message)
	}
	list, _ = eng.Handle(api.Make_Request_list()).Cast_list()
	if len(list) != 3 {
		t.Fatalf("list = %d calculations, want 3", len(list))
	}
}

// TestHandleJSON is the wire format: ADL JSON both ways.
func TestHandleJSON(t *testing.T) {
	var (
		eng   = newEngine(t, store.NewSeededStore())
		cases = []struct {
			req  string
			want string
		}{
			{
				req:  `{"evaluate": {"text": "2 + 3 * 4", "bindings": []}}`,
				want: `{"evaluated":{"value":14,"printed":"(2 + (3 * 4))"}}`,
			},
			{
				req:  `{"parse": "1 +"}`,
				want: `"at":{"just":{"line":1,"column":4}}`,
			},
			{
				req:  `{"delete": "7"}`,
				want: `{"error":{"message":"no calculation \"7\"","at":{"nothing":null}}}`,
			},
			{
				req:  `{"put": {"id": "", "name": "n", "text": "1"}}`,
				want: `{"put":{"id":"4","name":"n","text":"1","bindings":[],"base":"decimal","notes":{"nothing":null},"starred":false}}`,
			},
			{
				req:  `{"put": {"id": "8", "name": "m", "text": "2", "notes": "nothing", "base": "hex"}}`,
				want: `{"put":{"id":"8","name":"m","text":"2","bindings":[],"base":"hex","notes":{"nothing":null},"starred":false}}`,
			},
			{
				req:  `{"nothing": null}`,
				want: `{"error":{"message":"decoding the request: `,
			},
		}
	)
	for _, c := range cases {
		t.Run(c.req, func(t *testing.T) {
			var got = eng.HandleJSON(c.req)
			if !strings.Contains(got, c.want) {
				t.Fatalf("HandleJSON(%s) = %s, want it to contain %s", c.req, got, c.want)
			}
		})
	}
}
