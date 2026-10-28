// Command calc evaluates an expression: the text on standard input, in
// spec/calc.ohm's syntax, and a binding per -b. It writes the value,
// then the expression fully parenthesised, one per line.
//
//	$ echo '(x + 3) * y' | go run ./clis/calc -b x=5 -b y=1
//	8
//	((x + 3) * y)
//
// The parser is the compiled grammar that package grammar embeds, and
// the evaluator is package eval: the engine's, with no store.
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/jpillora/opts"
	"github.com/ohmjs/ohm-go/ohm"

	"engine/ast"
	"engine/eval"
	"engine/grammar"
	"engine/types/calc"
)

type rootCmd struct {
	Bind []string `opts:"short=b" help:"A binding, name=value, such as x=5. Give one -b per variable; a name given twice takes its last value."`
}

func newRootCmd() *rootCmd {
	return &rootCmd{
		Bind: []string{},
	}
}

// Run reads standard input and writes standard output.
func (c *rootCmd) Run() error {
	return c.run(os.Stdin, os.Stdout)
}

// run is Run over explicit streams, so a test can drive it.
func (c *rootCmd) run(in io.Reader, out io.Writer) error {
	var (
		input []byte
		env   eval.Env
		gmr   *ohm.Grammar
		exp   calc.Exp
		value int64
		err   error
	)
	if env, err = bindings(c.Bind); err != nil {
		return err
	}
	if input, err = io.ReadAll(in); err != nil {
		return fmt.Errorf("reading input: %w", err)
	}
	if gmr, err = grammar.New(context.Background()); err != nil {
		return err
	}
	defer gmr.Close()
	if exp, err = ast.Parse(gmr, strings.TrimSpace(string(input))); err != nil {
		return err
	}
	if value, err = eval.Eval(exp, env); err != nil {
		return err
	}
	_, err = fmt.Fprintf(out, "%d\n%s\n", value, ast.Print(exp))
	return err
}

// errBinding is a -b that is not name=value with an Int64 value.
var errBinding = errors.New("a binding is name=value, such as x=5")

// bindings reads each -b into the environment.
func bindings(binds []string) (eval.Env, error) {
	var (
		env = eval.Env{}
		v   int64
		err error
	)
	for _, b := range binds {
		var name, text, ok = strings.Cut(b, "=")
		name = strings.TrimSpace(name)
		if !ok || name == "" {
			return nil, fmt.Errorf("%w: %q", errBinding, b)
		}
		if v, err = strconv.ParseInt(strings.TrimSpace(text), 10, 64); err != nil {
			return nil, fmt.Errorf("%w: %q has no Int64 value", errBinding, b)
		}
		env[name] = v
	}
	return env, nil
}

func main() {
	var (
		cli opts.ParsedOpts
		err error
	)
	if cli, err = opts.New(newRootCmd()).
		Name("calc").
		EmbedGlobalFlagSet().
		Complete().
		ParseArgsError(os.Args); err != nil {
		fmt.Fprintf(os.Stderr, "%v", err)
		os.Exit(1)
	}
	// An error from Run is about the expression or a binding, not about
	// how the command was called, so the help text is left out.
	if err = cli.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(2)
	}
}
