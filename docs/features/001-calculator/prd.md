# calculator: the starter's application

`protowx` is said "proto works". This document specifies its
application: a calculator over integers, the arithmetic example of
ohm-go, and a page that creates, reads, updates and deletes the
calculations it evaluates, each a record of an ADL type. Section 1 is
the calculator: the grammar, the AST and the evaluator. Section 2 is
the model and the protocol, section 3 the server, section 4 the page.
Sections 5 to 9 are the dictation, the feedback report, the traces,
the stack and the manuals. Each part of the stack has one real use
here, so a reader sees how the part is wired and not only that it is
present.

**Status.** The starter is at its first tag, `v0.1.0`. Sections 1 to
6 are built: the calculator, the model and the protocol, the server,
the page, the dictation and the feedback report. Section 8, the
stack, is built without Jaeger, and section 9, the manuals, without
`traces.md`. Section 7, the traces, waits for the traces: its bullets
in [plan.md](plan.md) are not ticked, and Jaeger and `traces.md` come
with them. Features 002 to 006 under `docs/features/` are the todo
after the tag.

## Decisions at a glance

| concern                    | decision                                                               | runners-up                                 |
|----------------------------|------------------------------------------------------------------------|--------------------------------------------|
| what the calculator does   | **ohm-go's arithmetic example: integers, `+ - * /`, variables**        | a differential equation solver; floats     |
| what Ohm parses            | **the expression, with `calc.ohm`, the example's grammar as it is**    | a hand-written parser                      |
| the ADL files              | **`calc.adl` the AST, `model.adl` the record, `api.adl` the protocol** | one file                                   |
| the record the page edits  | **`model.Calculation`: name, text, bindings, base, notes, a star**     | the AST itself as the record               |
| where the records are kept | **in memory offline; a JSON file under `--store` connected**           | `localStorage`; SQLite                     |
| the engine's transports    | **both, the worker and HTTP, chosen in `factory.ts` alone**            | HTTP only                                  |
| the CRUD form              | **hand-written Solid components over `Calculation`, at first**         | adl-ui's dynamic render                    |
| the result on the page     | **the value, and the expression fully parenthesised**                  | the value alone; a parse tree              |
| kronk                      | **`services/myw`, My Whisper; the page dictates**                      | a language model through kronk; drop kronk |
| the feedback report        | **the record button, the dialog, `--bugs`, `.bugreports/`**            | none                                       |
| the traces                 | **the page's sender, `--otlp-url`, Jaeger in the stack**               | none; metrics and logs too                 |
| the stack                  | **`bff`, `myw` and Jaeger behind one tailnet node**                    | loopback only                              |
| tsnet in the binaries      | **none**: the tailnet is the stack's container, not `bff`'s            | tsnet in `bff`                             |
| the manuals                | **both, with the three change logs, cut to this page**                 | a `README.md` alone                        |

## 1. The calculator

### 1.1 What it does

A calculation is one arithmetic expression over integers, with
variables that the record binds:

```
(x + 3) * y - 10 / 2
```

with `x = 5` and `y = 1` is `3`. The four operators have their usual
precedence, and parentheses override it. The value is an integer, and
division is integer division. This is ohm-go's worked example,
`examples/generic-methods/arith.ohm`, with its evaluator and its
printer, and the starter takes it as it is: the grammar, the two
visitors and the one error, division by zero, are already written
against the generated visitor the starter uses.

### 1.2 The grammar

`spec/calc.ohm` is the example's grammar, renamed. It is the one place
the starter uses Ohm. The rule "the grammar is the specification"
holds here, root `AGENTS.md`, so the rules are quoted in full and
agreed with this document.

```
calc {
  Exp
    = AddExp

  AddExp
    = AddExp "+" MulExp  -- plus
    | AddExp "-" MulExp  -- minus
    | MulExp

  MulExp
    = MulExp "*" PriExp  -- times
    | MulExp "/" PriExp  -- divide
    | PriExp

  PriExp
    = "(" Exp ")"  -- paren
    | ident
    | number

  ident  (an identifier)
    = letter alnum*

  number  (a number)
    = digit+
}
```

`Exp` is the start rule. It is applied once, in `PriExp`, and has no
description, so check after `task calc:ohm2wasm` that the compiler
kept it as a function, as `engine/AGENTS.md` says to; if it did not,
the fix is the description `Exp (an expression)`, and nothing else
changes.

What the grammar does not decide, the evaluator does: a variable's
value is in the record's bindings, section 2.1, and a name with no
binding is `unknown variable x`. There is no function and no constant
in the first tag. A function's name would be a registry in the
evaluator, and not a grammar change; a
`number` with a fraction or a `^` would be a grammar change,
discussed when it is wanted.

### 1.3 The AST

`spec/calc.adl` is the AST the builder makes from the parse tree:

```
module calc {

union Exp {
    Int64 num;
    String variable;
    Binary bin;
};

struct Binary {
    Op op;
    Exp left;
    Exp right;
};

union Op {
    Void plus;
    Void minus;
    Void times;
    Void divide;
};

};
```

`task calc:goadlc` generates `engine/types/calc/` from it, and `task
calc:gen_visitor` generates `engine/visitor/` from the grammar.
`engine/ast/build.go` is a visitor over the generated types, with the
`var (...)` block and the multi-line literal of `go-style.md`. `engine/ast/printer.go` writes an `Exp`
back as text, fully parenthesised, as the example's printer does, so
the precedence the grammar assigned is visible: `(x + 3) * y - 10 / 2`
prints as `(((x + 3) * y) - (10 / 2))`.

The example evaluates the parse tree directly, with no AST between.
The calculator puts the AST in, because the AST is what crosses the
protocol as a `parse` answer and what the page shows: the example's
shape is kept for the two visitors, and the AST is the thing they
visit after the builder has run.

### 1.4 The evaluator

`engine/eval/` evaluates an `Exp` against a map of bindings.
`Eval(exp, env)` returns an `int64`. The errors, each a sentinel:

| error                      | message                    |
|----------------------------|----------------------------|
| a variable with no binding | `unknown variable x`       |
| a division by zero         | `division by zero: 10 / 0` |
| a value past `int64`       | `the value overflows`      |

The division message shows the divisor as the printer writes it,
which is what the example does with its printer from inside its
evaluator.

Tests pin the evaluator on the example's cases, `42`, `x + y`,
`(x + 3) * y`, `10 / 0`, and on precedence, `2 + 3 * 4` is `14`.

## 2. The model and the protocol

### 2.1 The record

`spec/model.adl` is the record the page edits. It is chosen to show
one of each ADL shape a form has to draw: a string, a vector of
structs, a union, an optional, a boolean.

```
module model {

import sys.types.Maybe;

newtype CalculationId = String;

struct Calculation {
    CalculationId id;
    String name;
    /// The expression, in calc.ohm's syntax.
    String text;
    /// The variables the expression may name.
    Vector<Binding> bindings = [];
    /// How the result is shown.
    Base base = "decimal";
    Maybe<String> notes = "nothing";
    Bool starred = false;
};

struct Binding {
    String name;
    Int64 value;
};

union Base {
    Void decimal;
    Void hex;
    Void binary;
};

struct Store {
    Vector<Calculation> calculations = [];
};

};
```

The text is kept as text, not as the AST. The page edits text; the
engine parses it on each `parse` and each `evaluate`. A record whose
text does not parse is still a record: a draft the user is still
writing.

### 2.2 The protocol

`spec/api.adl` is the request and response between the page and the
engine, in both transports:

```
module api {

import model.Calculation;
import model.CalculationId;
import model.Binding;
import calc.Exp;
import sys.types.Maybe;

union Request {
    /// Every calculation in the store.
    Void list;
    /// One calculation by id.
    CalculationId get;
    /// Create or update: a put with an empty id creates, and the
    /// response carries the id.
    Calculation put;
    /// Forget a calculation.
    CalculationId delete;
    /// Parse a text: the AST, or the first error and where it is.
    String parse;
    /// Parse and evaluate.
    EvaluateReq evaluate;
};

struct EvaluateReq {
    String text;
    Vector<Binding> bindings;
};

union Response {
    Vector<Calculation> list;
    Calculation got;
    Calculation put;
    CalculationId deleted;
    ParseResp parsed;
    EvaluateResp evaluated;
    Error error;
};

struct ParseResp {
    Exp exp;
    /// The expression fully parenthesised.
    String printed;
};

struct EvaluateResp {
    Int64 value;
    String printed;
};

struct Error {
    String message;
    /// Where in the text, for a parse error; absent otherwise.
    Maybe<Position> at;
};

struct Position {
    Int32 line;
    Int32 column;
};

};
```

An engine error is a `200` carrying the `error` branch. The page shows it beside the part it is about: a parse error under
the text, at its column; an evaluation error in the result; a store
error on the list.

Both generators run over the three files. `task calc:goadlc` writes
`engine/types/calc/`, `engine/types/model/` and `engine/types/api/`.
`task calc:adl-ts` writes `web/packages/client/src/adl/`. Neither
output is hand-edited.

### 2.3 The store

The engine holds a `Store` behind a `Storage` interface with two
methods, `Load` and `Save`. The wasm build has the memory store,
seeded with three calculations so the page opens with something to
click: the example's `(x + 3) * y`, a precedence case, and one that
divides by zero. `bff` has the file store: `--store calculations.json`,
read at start, written whole on each `put` and `delete`. A write that
fails is an `error` response, and the engine's copy stays as it was,
so the copy and the file agree. A missing file starts from the three
seeded calculations, and is written at the first change.

The memory store loses its changes on reload. The page says so, once,
in the offline mode's status line: `offline: changes are kept until
reload`. This is the line between the offline page and the connected
one, and the page keeps it visible rather than papering over it with `localStorage`, which would put a store in the
client and break the transport seam.

This is the storage model of the first tag only. A later feature
replaces it with the server's persistent storage, behind the same
`Storage` interface.

## 3. The server

`services/bff` is the server. It serves the page's `dist/`, answers
`POST /api/calc` from one engine behind one mutex, takes the feedback
report, forwards the page's traces, and tells the page where My
Whisper and the trace viewer are through `GET /api/config`.

| file           | role                                                          |
|----------------|---------------------------------------------------------------|
| `main.go`      | the flags, the mux, the graceful stop                         |
| `server.go`    | the static handler: the fallback, the cache headers, the log  |
| `engine.go`    | `POST /api/calc`: one engine behind one mutex                 |
| `store.go`     | the file store under `--store`                                |
| `bugreport.go` | `POST /api/bugreport`, `/screenshot`, `/audio`: `--bugs`      |
| `traces.go`    | `--otlp-url`, `--trace-view-url`, the SDK, `POST /api/traces` |
| `config.go`    | `GET /api/config`: the services, the viewer, `--bugs`         |
| `myw.go`       | `--myw-url`                                                   |
| `browser.go`   | `--open`                                                      |

Its flags:

| flag               | default             | what                                                 |
|--------------------|---------------------|------------------------------------------------------|
| `--addr`           | `127.0.0.1:8080`    | the listener                                         |
| `--dir`            | `web/apps/app/dist` | the static files                                     |
| `--api`            | `true`              | the engine route; `false` is a static server         |
| `--store`          | `calculations.json` | the file store                                       |
| `--bugs`           | `.bugreports`       | where a report is written; empty turns the route off |
| `--myw-url`        | empty               | the transcription service; empty hides **dictate**   |
| `--otlp-url`       | empty               | where spans go; empty wires nothing                  |
| `--trace-view-url` | empty               | the viewer the report's trace line links to          |
| `--open`           | empty               | the path to open in a browser, such as `/?offline`   |

The engine API is single-tenant and correct on loopback only: one
store, one grammar, one mutex. `services/bff/AGENTS.md` says so, and
leaves sessions to a later feature. `bff` has no tsnet: the one wider
bind is the stack's tailscale container, section 8.

The CLI is `jpillora/opts`, built with the `go-cli` skill, so the
skill has a use here.

## 4. The page

### 4.1 The packages

| package                | holds                                                            |
|------------------------|------------------------------------------------------------------|
| `web/packages/client/` | the two transports, the factory, the log, the typed client       |
| `web/packages/ui/`     | the Solid components and `theme.css`                             |
| `web/apps/app/`        | the Vite app: the page, the report, the trace sender, the mic    |
| `web/regression/`      | the Playwright suite: the runner, the scenarios, their baselines |

`client` holds `factory.ts`, `worker.ts`, `workerEngine.ts`,
`http.ts` and `log.ts`: the two transports, the choice between them,
and the log. `engine.ts`, the typed client, has one method per
request of `api.adl`. The page picks its mode at startup from the URL
and `GET /api/config`, and nothing below `createEngine` knows which
mode it is in.

### 4.2 The parts on screen

The page is one screen, with three parts side by side and a bar
above them. Each part has its name in `docs/glossary.md` and its
tokens in `theme.css`, in the commit that adds it.

- **The bar**, at the top. The **record** button of section 6, the
  mode, and the status line.
- **The calculation list**, on the left. One row per calculation: its
  star, its name. A **new** button above the rows. A click on a row
  opens it in the form. The row that is open is marked in colour, not
  in size.
- **The form**, in the middle. The fields of `model.Calculation`: the
  name, the text in an input, the bindings as a small table with a
  name and a value per row and an **add** row below, the base as a
  select, the notes as a text area that a checkbox shows and hides,
  the star as a checkbox. **save** and **delete** below. A parse error
  sits under the text, at its column. The form is the calculator:
  **evaluate** is beside **save**, and the **dictate** button of
  section 5 is beside the text.
- **The result**, on the right. The value, large, in the record's
  base, and under it the expression fully parenthesised. An
  evaluation error replaces the value with its message.

Controls stay put: the list's **new** stays above the rows, the
buttons keep their width, a row's state is a colour.  `web/AGENTS.md`
keeps the rule and its exceptions.

### 4.3 Tests

- `client`: Vitest in node, against the real wasm: a `put` then a
  `list`, an `evaluate` of each case of section 1.4.
- `ui`: Vitest in browser mode, one test per component.
- `regression/`: three scenarios, `crud.json`, `evaluate.json` and
  `report.json`, with their baselines. The `offline` project runs on
  `bff --api=false --bugs ''`; the `connected` project on `bff --api
  --store <tmp> --bugs <tmp>`; the `stack` project, section 8, on
  the compose stack with Jaeger.
  A scenario's `server` names one server or a list: `crud` and
  `evaluate` run on `offline` and `connected`, `report` on
  `connected`. Each server has its own baselines,
  `<name>.json-snapshots/<server>/<shot>-linux.png`, since the bar
  names the mode.

## 5. The dictation

`services/myw` is **My Whisper**: kronk's one use. It is whisper.cpp
inside a Go binary, the model in the binary, one route that takes
audio and answers text. It has no tsnet: the module `myw`, the binary
`myw`, the tasks `myw:model`, `myw:serve`, `myw:test`, the node
`myw-<branch>` in the stack. The page's `transcribeClient.ts` and
`narrationMic.ts` are in `web/apps/app/`, and a **dictate** button
beside the text records until it is clicked again and puts the
transcript after the text, less a final full stop. The button is drawn only when `GET
/api/config` names a service, so the offline page and a `bff` with no
`--myw-url` have no button.

The calculator is whole without it: the flake builds whisper.cpp from
source once per machine, and a reader who wants it without a
model deletes the module and the button and nothing else.

## 6. The feedback report

The feedback report: a **record** button starts a recording, the
recording holds the model as the engine has it, every message that
crosses to the engine and every line the status line says, a second
click ends it and opens the dialog, and the result is one Markdown
file an agent reads as a prompt. The route is `POST /api/bugreport`,
with `/screenshot` and `/audio` beside it, under `--bugs`; the files
go to `.bugreports/`, which git ignores. The narration records through
the mic of section 5, and the transcription service writes its text.

The recording holds the `Store` at the start, then each `put` and
`delete` as the engine saw them, and each response. That is a report
that records every change to the ADL model's state. The first tag
records the messages; a later feature adds the UI state.

The dialog, `BugReportDialog.tsx`, and `bugReport.ts`, `recorder.ts`,
`recording.ts`, `reportSink.ts` and `screenshot.ts` are in
`web/apps/app/`. The report has its kinds and its type prompts.
`.bugreports/AGENTS.md` is the reader's instructions for a report.

## 7. The traces

The page starts a trace when a recording starts, sends its spans as
OTLP/JSON to `POST /api/traces`, and `bff` forwards them to the
viewer; `bff`'s own spans come from the OpenTelemetry Go SDK in
`traces.go`, with `otelhttp` round the mux and a sampler that spans a
request only when the page's `traceparent` says so. The report's trace
line links to `<view>/trace/<id>`.

`/api/calc` is the one traced route, `engine.lock` and `engine.handle`
the two spans under it. The rule that a span never carries a value
holds: ids, kinds, counts, times and sizes, and never a calculation's
text. `TestTraces_Spans` and `trace.test.ts` keep the two lists. The
transcription service is not traced.

The traces come last of the parts here. Until they land, the plan's
bullets for them stay unticked, and `bff` has no `--otlp-url`.

## 8. The stack

`deploy/compose/` holds `bff`, `myw` and Jaeger in one compose project
behind one tailscale container, as the node `protowx-<branch>`. The
page is at `https://protowx-<branch>.<domain>/`, the transcription on
`:8443` and the trace viewer on `:8445`. `compose.regression.yaml` is
the same stack without a tailnet, so the gate's stack step runs the
`report.json` scenario against Jaeger.

The tailnet is the container's. There is no tsnet inside `bff` or
`myw`, and no `task bff:tailnet`: one way onto the tailnet is enough
for a starter, and the container is the one the stack already needs.
`docs/devtools/compose-tailscale.md` is the page.

## 9. The manuals

`docs/product/` has one page of each kind, so the shape is seen. `user_manual/` has its `AGENTS.md`, its `README.md`,
one guide, `evaluating-an-expression.md`, and its change log.
`admin_manual/` has its `AGENTS.md`, `traces.md`,
`running-the-stack.md` and its change log. `docs/product/changelog.md`
is the product log. Each change log starts with the first tag's entry.

The rule "Docs that quote the code", in the root `AGENTS.md`, has two
rows:
`evaluating-an-expression.md` quotes the errors of section 1.4 and the
words of the form, and `traces.md` quotes the span names.
