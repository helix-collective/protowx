package ast

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/ohmjs/ohm-go/ohm"

	"engine/grammar"
	"engine/types/calc"
)

func newGrammar(t *testing.T) *ohm.Grammar {
	t.Helper()
	var (
		gmr *ohm.Grammar
		err error
	)
	if gmr, err = grammar.New(context.Background()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		gmr.Close()
	})
	return gmr
}

func bin(op calc.Op, left, right calc.Exp) calc.Exp {
	return calc.Make_Exp_bin(calc.Make_Binary(op, left, right))
}

func num(n int64) calc.Exp {
	return calc.Make_Exp_num(n)
}

func variable(name string) calc.Exp {
	return calc.Make_Exp_variable(name)
}

// TestPrint holds the example's cases, its evaluator's texts, one case
// per operator, and the case of PRD section 5.3.
func TestPrint(t *testing.T) {
	var (
		gmr   = newGrammar(t)
		cases = []struct {
			src  string
			want string
		}{
			{
				src:  "x",
				want: "x",
			},
			{
				src:  "42",
				want: "42",
			},
			{
				src:  "1 + 2 * 3",
				want: "(1 + (2 * 3))",
			},
			{
				src:  "(1 + 2) * 3",
				want: "((1 + 2) * 3)",
			},
			{
				src:  "10 - 4 - 3",
				want: "((10 - 4) - 3)",
			},
			{
				src:  "8 / 2 / 2",
				want: "((8 / 2) / 2)",
			},
			{
				src:  "x * 2 + y",
				want: "((x * 2) + y)",
			},
			{
				src:  "((x))",
				want: "x",
			},
			{
				src:  "a1 / (b2 * 3)",
				want: "(a1 / (b2 * 3))",
			},
			{
				src:  "x * (y + 2)",
				want: "(x * (y + 2))",
			},
			{
				src:  "1 + 2",
				want: "(1 + 2)",
			},
			{
				src:  "5 - 2",
				want: "(5 - 2)",
			},
			{
				src:  "3 * 4",
				want: "(3 * 4)",
			},
			{
				src:  "10 / 2",
				want: "(10 / 2)",
			},
			{
				src:  "(x + 3) * y - 10 / 2",
				want: "(((x + 3) * y) - (10 / 2))",
			},
			{
				src:  " 1\n+\t2 ",
				want: "(1 + 2)",
			},
		}
	)
	for _, c := range cases {
		t.Run(c.src, func(t *testing.T) {
			var (
				exp calc.Exp
				got string
				err error
			)
			if exp, err = Parse(gmr, c.src); err != nil {
				t.Fatalf("Parse(%q): %v", c.src, err)
			}
			if got = Print(exp); got != c.want {
				t.Fatalf("Print(Parse(%q)) = %q, want %q", c.src, got, c.want)
			}
		})
	}
}

// TestParseAST pins the tree the builder makes: the operators, the
// leaves, and the left association.
func TestParseAST(t *testing.T) {
	var (
		gmr   = newGrammar(t)
		cases = []struct {
			src  string
			want calc.Exp
		}{
			{
				src:  "42",
				want: num(42),
			},
			{
				src:  "x1",
				want: variable("x1"),
			},
			{
				src:  "1 + 2 * x",
				want: bin(calc.Make_Op_plus(), num(1), bin(calc.Make_Op_times(), num(2), variable("x"))),
			},
			{
				src:  "10 - 4 - 3",
				want: bin(calc.Make_Op_minus(), bin(calc.Make_Op_minus(), num(10), num(4)), num(3)),
			},
			{
				src:  "8 / (2 / 2)",
				want: bin(calc.Make_Op_divide(), num(8), bin(calc.Make_Op_divide(), num(2), num(2))),
			},
		}
	)
	for _, c := range cases {
		t.Run(c.src, func(t *testing.T) {
			var (
				got calc.Exp
				err error
			)
			if got, err = Parse(gmr, c.src); err != nil {
				t.Fatalf("Parse(%q): %v", c.src, err)
			}
			if !reflect.DeepEqual(got, c.want) {
				t.Fatalf("Parse(%q) = %s, want %s", c.src, Print(got), Print(c.want))
			}
		})
	}
}

// TestRoundTrip checks text to AST to text: the printed text parses
// back to the same AST, and prints the same again.
func TestRoundTrip(t *testing.T) {
	var (
		gmr  = newGrammar(t)
		srcs = []string{
			"42",
			"x",
			"1 + 2 * 3",
			"(1 + 2) * 3",
			"10 - 4 - 3",
			"10 - (4 - 3)",
			"8 / 2 / 2",
			"a1 / (b2 * 3)",
			"(x + 3) * y - 10 / 2",
		}
	)
	for _, src := range srcs {
		t.Run(src, func(t *testing.T) {
			var (
				first, second calc.Exp
				text          string
				err           error
			)
			if first, err = Parse(gmr, src); err != nil {
				t.Fatalf("Parse(%q): %v", src, err)
			}
			text = Print(first)
			if second, err = Parse(gmr, text); err != nil {
				t.Fatalf("Parse(%q), the printed text: %v", text, err)
			}
			if !reflect.DeepEqual(first, second) {
				t.Fatalf("%q prints as %q, which parses to %s", src, text, Print(second))
			}
			if Print(second) != text {
				t.Fatalf("%q prints as %q, then as %q", src, text, Print(second))
			}
		})
	}
}

// TestParseError checks the line and the column of a text that does
// not match, and the one-line message.
//
// The message names the expected tokens when the runtime finds them.
// ohm-go 1.1.0 does not find them after a complete operand, as in
// "(1 + 2": its recordFailures overflows the wasm stack, so the message
// says "match failed". The line and the column are right in each case.
func TestParseError(t *testing.T) {
	var (
		gmr   = newGrammar(t)
		cases = []struct {
			src     string
			line    int
			column  int
			message string
		}{
			{
				src:     "1 +",
				line:    1,
				column:  4,
				message: `Line 1, col 4: expected "(", an identifier, or a number`,
			},
			{
				src:     "(1 + 2",
				line:    1,
				column:  7,
				message: `Line 1, col 7: match failed`,
			},
			{
				src:     "1 +\n2 *\n* 3",
				line:    3,
				column:  1,
				message: `Line 3, col 1: match failed`,
			},
			{
				src:     "",
				line:    1,
				column:  1,
				message: `Line 1, col 1: expected "(", an identifier, or a number`,
			},
		}
	)
	for _, c := range cases {
		t.Run(c.src, func(t *testing.T) {
			var (
				perr *ParseError
				err  error
			)
			if _, err = Parse(gmr, c.src); !errors.As(err, &perr) {
				t.Fatalf("Parse(%q) = %v, want a *ParseError", c.src, err)
			}
			if perr.Line != c.line || perr.Column != c.column {
				t.Errorf("Parse(%q) fails at line %d, column %d; want line %d, column %d",
					c.src, perr.Line, perr.Column, c.line, c.column)
			}
			if perr.Message != c.message {
				t.Errorf("Parse(%q) message = %q, want %q", c.src, perr.Message, c.message)
			}
		})
	}
}

// TestNumberOverflow: the grammar reads any run of digits, and the
// builder refuses one past Int64.
func TestNumberOverflow(t *testing.T) {
	var (
		gmr = newGrammar(t)
		err error
	)
	if _, err = Parse(gmr, "9223372036854775807"); err != nil {
		t.Fatalf("the largest Int64: %v", err)
	}
	if _, err = Parse(gmr, "1 + 9223372036854775808"); !errors.Is(err, ErrNumber) {
		t.Fatalf("one past the largest Int64: %v, want ErrNumber", err)
	}
}
