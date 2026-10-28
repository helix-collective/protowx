package main

import (
	"bytes"
	"errors"
	"strings"
	"testing"

	"engine/ast"
	"engine/eval"
)

func TestRun(t *testing.T) {
	var (
		out bytes.Buffer
		cmd = &rootCmd{
			Bind: []string{
				"x=5",
				"y=1",
			},
		}
	)
	if err := cmd.run(strings.NewReader("(x + 3) * y\n"), &out); err != nil {
		t.Fatal(err)
	}
	if out.String() != "8\n((x + 3) * y)\n" {
		t.Fatalf("out = %q", out.String())
	}
}

func TestRunErrors(t *testing.T) {
	var cases = []struct {
		in   string
		bind []string
		is   error
		want string
	}{
		{
			in:   "x + 1",
			is:   eval.ErrUnknownVariable,
			want: "unknown variable x",
		},
		{
			in:   "10 / 0",
			is:   eval.ErrDivisionByZero,
			want: "division by zero: 10 / 0",
		},
		{
			in:   "x",
			bind: []string{"x"},
			is:   errBinding,
			want: `a binding is name=value, such as x=5: "x"`,
		},
		{
			in:   "x",
			bind: []string{"x=five"},
			is:   errBinding,
			want: `a binding is name=value, such as x=5: "x=five" has no Int64 value`,
		},
	}
	for _, c := range cases {
		t.Run(c.in, func(t *testing.T) {
			var (
				out bytes.Buffer
				err = (&rootCmd{
					Bind: c.bind,
				}).run(strings.NewReader(c.in), &out)
			)
			if !errors.Is(err, c.is) || err.Error() != c.want {
				t.Fatalf("err = %v, want %q", err, c.want)
			}
		})
	}
}

func TestRunParseError(t *testing.T) {
	var (
		out  bytes.Buffer
		perr *ast.ParseError
		err  = newRootCmd().run(strings.NewReader("1 +"), &out)
	)
	if !errors.As(err, &perr) || perr.Line != 1 || perr.Column != 4 {
		t.Fatalf("err = %v, want a parse error at 1:4", err)
	}
}
