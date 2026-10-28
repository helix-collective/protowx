package eval

import (
	"context"
	"errors"
	"testing"

	"github.com/ohmjs/ohm-go/ohm"

	"engine/ast"
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

func parse(t *testing.T, gmr *ohm.Grammar, src string) calc.Exp {
	t.Helper()
	var (
		exp calc.Exp
		err error
	)
	if exp, err = ast.Parse(gmr, src); err != nil {
		t.Fatalf("Parse(%q): %v", src, err)
	}
	return exp
}

// TestEval holds the example's cases, the cases of PRD section 1.4 and
// precedence.
func TestEval(t *testing.T) {
	var (
		gmr = newGrammar(t)
		env = Env{
			"x": 5,
			"y": 1,
		}
		cases = []struct {
			src  string
			want int64
		}{
			{
				src:  "42",
				want: 42,
			},
			{
				src:  "x + y",
				want: 6,
			},
			{
				src:  "(x + 3) * y",
				want: 8,
			},
			{
				src:  "2 + 3 * 4",
				want: 14,
			},
			{
				src:  "1 + 2 * 3",
				want: 7,
			},
			{
				src:  "(1 + 2) * 3",
				want: 9,
			},
			{
				src:  "10 - 4 - 3",
				want: 3,
			},
			{
				src:  "8 / 2 / 2",
				want: 2,
			},
			{
				src:  "x * 2 + y",
				want: 11,
			},
			{
				src:  "((x))",
				want: 5,
			},
			{
				src:  "7 / 2",
				want: 3,
			},
			{
				src:  "0 - 7 / 2",
				want: -3,
			},
			{
				src:  "9223372036854775807",
				want: 9223372036854775807,
			},
			{
				src:  "0 - 9223372036854775807 - 1",
				want: -9223372036854775808,
			},
		}
	)
	for _, c := range cases {
		t.Run(c.src, func(t *testing.T) {
			var (
				got int64
				err error
			)
			if got, err = Eval(parse(t, gmr, c.src), env); err != nil {
				t.Fatalf("Eval(%q): %v", c.src, err)
			}
			if got != c.want {
				t.Fatalf("Eval(%q) = %d, want %d", c.src, got, c.want)
			}
		})
	}
}

// TestEvalErrors pins each error of PRD section 1.4: its sentinel and
// its message.
func TestEvalErrors(t *testing.T) {
	var (
		gmr = newGrammar(t)
		env = Env{
			"x": 5,
		}
		cases = []struct {
			src     string
			is      error
			message string
		}{
			{
				src:     "x + z",
				is:      ErrUnknownVariable,
				message: "unknown variable z",
			},
			{
				src:     "10 / 0",
				is:      ErrDivisionByZero,
				message: "division by zero: 10 / 0",
			},
			{
				src:     "1 / (x - 5)",
				is:      ErrDivisionByZero,
				message: "division by zero: 1 / (x - 5)",
			},
			{
				src:     "(x + 1) / (2 - 2) * 3",
				is:      ErrDivisionByZero,
				message: "division by zero: (x + 1) / (2 - 2)",
			},
			{
				src:     "9223372036854775807 + 1",
				is:      ErrOverflow,
				message: "the value overflows",
			},
			{
				src:     "0 - 9223372036854775807 - 2",
				is:      ErrOverflow,
				message: "the value overflows",
			},
			{
				src:     "4611686018427387904 * 2",
				is:      ErrOverflow,
				message: "the value overflows",
			},
			{
				src:     "(0 - 9223372036854775807 - 1) * (0 - 1)",
				is:      ErrOverflow,
				message: "the value overflows",
			},
			{
				src:     "(0 - 9223372036854775807 - 1) / (0 - 1)",
				is:      ErrOverflow,
				message: "the value overflows",
			},
		}
	)
	for _, c := range cases {
		t.Run(c.src, func(t *testing.T) {
			var err error
			if _, err = Eval(parse(t, gmr, c.src), env); err == nil {
				t.Fatalf("Eval(%q) succeeded, want %q", c.src, c.message)
			}
			if !errors.Is(err, c.is) {
				t.Fatalf("Eval(%q) = %v, want it to wrap %v", c.src, err, c.is)
			}
			if err.Error() != c.message {
				t.Fatalf("Eval(%q) = %q, want %q", c.src, err, c.message)
			}
		})
	}
}
