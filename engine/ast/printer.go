package ast

import (
	"strconv"

	"engine/types/calc"
)

// Print writes exp back as text, fully parenthesised, so the precedence
// that the grammar assigned is visible: the text
// `(x + 3) * y - 10 / 2` prints as `(((x + 3) * y) - (10 / 2))`. The
// result parses back to the same AST.
func Print(exp calc.Exp) string {
	return calc.Handle_Exp(
		exp,
		func(num int64) string {
			return strconv.FormatInt(num, 10)
		},
		func(variable string) string {
			return variable
		},
		func(bin calc.Binary) string {
			return "(" + Print(bin.Left) + " " + OpText(bin.Op) + " " + Print(bin.Right) + ")"
		},
		nil,
	)
}

// OpText is the operator as calc.ohm writes it.
func OpText(op calc.Op) string {
	return calc.Handle_Op(
		op,
		func(struct{}) string {
			return "+"
		},
		func(struct{}) string {
			return "-"
		},
		func(struct{}) string {
			return "*"
		},
		func(struct{}) string {
			return "/"
		},
		nil,
	)
}
