// Package eval evaluates a calc.Exp, the AST of package ast, against a
// map of bindings. It is the example's evaluator, moved from the parse
// tree to the AST. docs/features/001-calculator/prd.md section 1.4.
package eval

import (
	"errors"
	"fmt"
	"math"

	"engine/ast"
	"engine/types/calc"
)

// The three errors of an evaluation. Each error that Eval returns
// wraps one of them, so errors.Is tells them apart.
var (
	// ErrUnknownVariable is a variable with no binding:
	// `unknown variable x`.
	ErrUnknownVariable = errors.New("unknown variable")
	// ErrDivisionByZero is a divisor that evaluates to 0:
	// `division by zero: 10 / 0`.
	ErrDivisionByZero = errors.New("division by zero")
	// ErrOverflow is a value past Int64: `the value overflows`.
	ErrOverflow = errors.New("the value overflows")
)

// Env is the bindings: a variable's name to its value.
type Env map[string]int64

// Eval returns the value of exp under env. A division truncates toward
// zero, as Go's does.
func Eval(exp calc.Exp, env Env) (int64, error) {
	return calc.HandleWithErr_Exp(
		exp,
		func(num int64) (int64, error) {
			return num, nil
		},
		func(variable string) (int64, error) {
			var (
				v  int64
				ok bool
			)
			if v, ok = env[variable]; !ok {
				return 0, fmt.Errorf("%w %s", ErrUnknownVariable, variable)
			}
			return v, nil
		},
		func(bin calc.Binary) (int64, error) {
			return binary(bin, env)
		},
		nil,
	)
}

// binary evaluates both operands, left first, and applies the operator.
func binary(bin calc.Binary, env Env) (int64, error) {
	var (
		l, r int64
		err  error
	)
	if l, err = Eval(bin.Left, env); err != nil {
		return 0, err
	}
	if r, err = Eval(bin.Right, env); err != nil {
		return 0, err
	}
	return calc.HandleWithErr_Op(
		bin.Op,
		func(struct{}) (int64, error) {
			return add(l, r)
		},
		func(struct{}) (int64, error) {
			return sub(l, r)
		},
		func(struct{}) (int64, error) {
			return mul(l, r)
		},
		func(struct{}) (int64, error) {
			if r == 0 {
				// The operands as the printer writes them, and not the
				// whole node, which the printer would wrap in parentheses.
				return 0, fmt.Errorf("%w: %s / %s", ErrDivisionByZero, ast.Print(bin.Left), ast.Print(bin.Right))
			}
			if l == math.MinInt64 && r == -1 {
				return 0, ErrOverflow
			}
			return l / r, nil
		},
		nil,
	)
}

func add(l, r int64) (int64, error) {
	var s = l + r
	// The sum overflows when both operands have the same sign and the
	// sum has the other one.
	if (l >= 0) == (r >= 0) && (s >= 0) != (l >= 0) {
		return 0, ErrOverflow
	}
	return s, nil
}

func sub(l, r int64) (int64, error) {
	var d = l - r
	// The difference overflows when the operands have different signs
	// and the difference has the sign of r.
	if (l >= 0) != (r >= 0) && (d >= 0) != (l >= 0) {
		return 0, ErrOverflow
	}
	return d, nil
}

func mul(l, r int64) (int64, error) {
	var p int64
	if l == 0 || r == 0 {
		return 0, nil
	}
	p = l * r
	if p/r != l || (l == -1 && r == math.MinInt64) || (r == -1 && l == math.MinInt64) {
		return 0, ErrOverflow
	}
	return p, nil
}
