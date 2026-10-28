package grammar

import (
	"context"
	"slices"
	"testing"

	"github.com/ohmjs/ohm-go/ohm"
)

// TestStartRuleIsAFunction checks that the compiler kept Exp as a
// function. The compiler inlines a rule that is applied in one place
// and has no description, and a match from an inlined rule fails.
// Exp is applied once, in PriExp. engine/AGENTS.md, "The start rule",
// gives the fix when this test fails.
func TestStartRuleIsAFunction(t *testing.T) {
	var (
		gmr *ohm.Grammar
		mr  *ohm.MatchResult
		err error
	)
	if gmr, err = New(context.Background()); err != nil {
		t.Fatal(err)
	}
	defer gmr.Close()
	if !slices.Contains(gmr.GetRuleNames(), StartRule) {
		t.Fatalf("%s is not in the rule names %v", StartRule, gmr.GetRuleNames())
	}
	if mr, err = gmr.Match("(x + 3) * y", StartRule); err != nil {
		t.Fatalf("matching from %s: %v", StartRule, err)
	}
	defer mr.Close()
	if !mr.Succeeded() {
		t.Fatalf("a match from %s failed: the compiler inlined it", StartRule)
	}
}
