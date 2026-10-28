// Package ast builds the ADL AST, package calc (generated from
// spec/calc.adl), from the ohm CST that the grammar spec/calc.ohm
// produces. The builder is a visitor over the generated package
// visitor, in the shape of ohm-go's examples/generic-methods.
package ast

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/ohmjs/ohm-go/ohm"

	"engine/grammar"
	"engine/types/calc"
	"engine/visitor"
)

// ErrNumber refuses a number that does not fit an Int64. The grammar
// reads any run of digits; the AST holds an Int64.
var ErrNumber = errors.New("the number overflows")

// ParseError is a text that does not match calc.ohm. Line and Column
// are 1-based; Column counts code points. Message is the one-line
// message of the runtime, such as
// `Line 1, col 5: expected "(", an identifier, or a number`.
type ParseError struct {
	Line    int
	Column  int
	Message string
}

// Error implements error.
func (e *ParseError) Error() string {
	return e.Message
}

// builder is the visitor from the CST to calc.Exp. The payload is
// unused (P=any), and every Visit method returns a calc.Exp (R). The
// rules with no Visit method here, Exp, AddExp, MulExp and PriExp, fall
// through to the generated DefaultAccept, which dispatches to the case
// that matched.
type builder struct{}

var (
	_ visitor.VisitorRE_AddExpPlus[any, calc.Exp]   = (*builder)(nil)
	_ visitor.VisitorRE_AddExpMinus[any, calc.Exp]  = (*builder)(nil)
	_ visitor.VisitorRE_MulExpTimes[any, calc.Exp]  = (*builder)(nil)
	_ visitor.VisitorRE_MulExpDivide[any, calc.Exp] = (*builder)(nil)
	_ visitor.VisitorRE_PriExpParen[any, calc.Exp]  = (*builder)(nil)
	_ visitor.VisitorRE_LexIdent[any, calc.Exp]     = (*builder)(nil)
	_ visitor.VisitorRE_LexNumber[any, calc.Exp]    = (*builder)(nil)
)

// acceptFn is the shape of an instantiated Accept<Arg>[any, calc.Exp]
// method value, which is what binary takes.
type acceptFn = func(visitor any, payload any) (calc.Exp, error)

// Parse matches input from the start rule Exp of gmr, a grammar from
// package grammar, and builds the AST. A text that does not match
// gives a *ParseError.
func Parse(gmr *ohm.Grammar, input string) (calc.Exp, error) {
	var (
		mr   *ohm.MatchResult
		root ohm.Node
		err  error
	)
	if mr, err = gmr.Match(input, grammar.StartRule); err != nil {
		return calc.Exp{}, fmt.Errorf("matching %s: %w", grammar.StartRule, err)
	}
	defer mr.Close()
	if !mr.Succeeded() {
		// Err reads the expected tokens while mr is the most recent
		// result, so it comes before the Close.
		return calc.Exp{}, parseError(mr)
	}
	if root, err = mr.GetCstRoot(); err != nil {
		return calc.Exp{}, fmt.Errorf("reading the cst: %w", err)
	}
	return Build(root)
}

// Build converts the CST rooted at root, which must be an Exp node,
// into the AST. Exp is the grammar's first rule, so the generated
// MakeNodeFromRoot wraps it.
func Build(root ohm.Node) (calc.Exp, error) {
	return visitor.MakeNodeFromRoot[any, calc.Exp](root)(root, &builder{}, nil)
}

// parseError turns the runtime's match error into a *ParseError.
func parseError(mr *ohm.MatchResult) error {
	var merr *ohm.MatchError
	if !errors.As(mr.Err(), &merr) {
		return &ParseError{
			Line:    1,
			Column:  1,
			Message: fmt.Sprintf("%q is not an expression", mr.Input()),
		}
	}
	return &ParseError{
		Line:    merr.Pos.Line,
		Column:  merr.Pos.Column,
		Message: merr.ShortMessage(),
	}
}

// VisitAddExpPlus implements [visitor.VisitorRE_AddExpPlus].
//
//	AddExp "+" MulExp  -- plus
func (b *builder) VisitAddExpPlus(node *visitor.AddExpPlus) (calc.Exp, error) {
	return b.binary(calc.Make_Op_plus(), node.AcceptAddExp[any, calc.Exp], node.AcceptMulExp[any, calc.Exp])
}

// VisitAddExpMinus implements [visitor.VisitorRE_AddExpMinus].
//
//	AddExp "-" MulExp  -- minus
func (b *builder) VisitAddExpMinus(node *visitor.AddExpMinus) (calc.Exp, error) {
	return b.binary(calc.Make_Op_minus(), node.AcceptAddExp[any, calc.Exp], node.AcceptMulExp[any, calc.Exp])
}

// VisitMulExpTimes implements [visitor.VisitorRE_MulExpTimes].
//
//	MulExp "*" PriExp  -- times
func (b *builder) VisitMulExpTimes(node *visitor.MulExpTimes) (calc.Exp, error) {
	return b.binary(calc.Make_Op_times(), node.AcceptMulExp[any, calc.Exp], node.AcceptPriExp[any, calc.Exp])
}

// VisitMulExpDivide implements [visitor.VisitorRE_MulExpDivide].
//
//	MulExp "/" PriExp  -- divide
func (b *builder) VisitMulExpDivide(node *visitor.MulExpDivide) (calc.Exp, error) {
	return b.binary(calc.Make_Op_divide(), node.AcceptMulExp[any, calc.Exp], node.AcceptPriExp[any, calc.Exp])
}

// VisitPriExpParen implements [visitor.VisitorRE_PriExpParen]. The
// parentheses are not in the AST: the tree's shape holds the grouping.
//
//	"(" Exp ")"  -- paren
func (b *builder) VisitPriExpParen(node *visitor.PriExpParen) (calc.Exp, error) {
	return node.AcceptExp[any, calc.Exp](b, nil)
}

// VisitLexIdent implements [visitor.VisitorRE_LexIdent]: a variable.
//
//	ident = letter alnum*
func (b *builder) VisitLexIdent(node *visitor.LexIdent) (calc.Exp, error) {
	return calc.Make_Exp_variable(node.Letter.SourceString() + node.Alnum.SourceString()), nil
}

// VisitLexNumber implements [visitor.VisitorRE_LexNumber]. A number
// past Int64 is refused under ErrNumber.
//
//	number = digit+
func (b *builder) VisitLexNumber(node *visitor.LexNumber) (calc.Exp, error) {
	var (
		digits = node.Digit.SourceString()
		n      int64
		err    error
	)
	if n, err = strconv.ParseInt(digits, 10, 64); err != nil {
		return calc.Exp{}, fmt.Errorf("%w: %s", ErrNumber, digits)
	}
	return calc.Make_Exp_num(n), nil
}

// binary builds both operands and joins them under op.
func (b *builder) binary(op calc.Op, left acceptFn, right acceptFn) (calc.Exp, error) {
	var (
		l, r calc.Exp
		err  error
	)
	if l, err = left(b, nil); err != nil {
		return calc.Exp{}, err
	}
	if r, err = right(b, nil); err != nil {
		return calc.Exp{}, err
	}
	return calc.Make_Exp_bin(calc.Make_Binary(op, l, r)), nil
}
