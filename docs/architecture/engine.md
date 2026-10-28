# The engine

The engine turns a text into a value, and keeps the calculations the
page edits. It is the Go module `engine`: the grammar to the AST, the
AST to the value, the store, and one function that answers a request.
Two entries run it: a Web Worker through WebAssembly, and `bff` over
HTTP. [The calculator's PRD](../features/001-calculator/prd.md),
sections 1 and 2, decided the shape.

## 1. The map

```
  spec/calc.ohm ──ohm2wasm──► grammar/calc.wasm ─┐
  spec/calc.ohm ──gen_visitor──► visitor/ ───────┤
  spec/*.adl ──goadlc──► types/calc, model, api ─┤
                                                 ▼
  text ──► ast.Parse ──► calc.Exp ──► eval.Eval ──► int64
                            │
                            └──► ast.Print ──► "((x + 3) * y)"

  api.Request ──► engine.Handle ──► api.Response
                      │
                      └──► store.Storage: Load once, Save on each change

  wasm/main.go: calcRequest(json) ──► engine.HandleJSON   (the worker)
  services/bff: POST /api/calc    ──► engine.HandleJSON   (one mutex)
```

| directory  | what it computes                                                 |
|------------|------------------------------------------------------------------|
| `grammar/` | the compiled grammar, embedded once; `grammar.New`               |
| `visitor/` | the typed parse tree and its visitors, generated from `calc.ohm` |
| `types/`   | the Go types of the three `.adl` files, generated                |
| `ast/`     | `Parse`: the text to `calc.Exp`; `Print`: `calc.Exp` to text     |
| `eval/`    | `Eval`: a `calc.Exp` and the bindings to an `int64`              |
| `store/`   | `Storage`; `MemoryStore`, and `Seed`, its three calculations     |
| `engine/`  | `Handle` and `HandleJSON`: one request in, one response out      |
| `wasm/`    | the `js/wasm` entry: `calcRequest` on the global                 |

## 2. The grammar to the AST

`spec/calc.ohm` is the grammar. `task calc:ohm2wasm` compiles it to
`grammar/calc.wasm`, and `task calc:gen_visitor` writes a typed parse
tree and its visitors to `visitor/`. `ast.Parse` matches a text from
the start rule `Exp`, and a builder visits the parse tree to make a
`calc.Exp`. The AST holds no parentheses: the tree's shape holds the
grouping.

A text that does not match is an `*ast.ParseError`, with the line and
the column, both from 1. `engine/AGENTS.md`, "Parse errors", gives the
messages.

`ast.Print` writes a `calc.Exp` back, fully parenthesised. The text
`(x + 3) * y - 10 / 2` prints as `(((x + 3) * y) - (10 / 2))`, so the
precedence that the grammar gave is visible.

## 3. The AST to the value

`eval.Eval(exp, env)` walks the AST, the left operand first. A division
truncates toward zero. Each failure wraps one of three sentinels:

| sentinel             | message                    |
|----------------------|----------------------------|
| `ErrUnknownVariable` | `unknown variable x`       |
| `ErrDivisionByZero`  | `division by zero: 10 / 0` |
| `ErrOverflow`        | `the value overflows`      |

The division message prints each operand with `ast.Print`, so
`1 / (x - 5)` says `division by zero: 1 / (x - 5)`.

## 4. The store

The engine keeps a `model.Store`, the list of calculations, behind
`store.Storage`. The engine calls `Load` once, when it is made, and
`Save` with the whole list after each `put` and `delete`. The engine
takes the change as its own only when `Save` succeeds. A `Save` that
fails is an `error` response, and the list stays as it was.

| storage       | where            | at start                              |
|---------------|------------------|---------------------------------------|
| `MemoryStore` | the wasm build   | the three seeded calculations         |
| file store    | `bff`, `--store` | the file; a missing file is the seeds |

The memory store loses its changes on reload. The file store writes
the file whole, through a temporary file and a rename.

A `put` with an empty id gives the calculation the next id: one more
than the largest id that is a decimal number. A `put` with an id
replaces that calculation, or adds it at the end.

## 5. One request in, one response out

`engine.Handle` takes an `api.Request` and answers an `api.Response`.
It never fails: each failure is the `error` branch, with a message and,
for a parse error, the position. `HandleJSON` is `Handle` over ADL JSON
strings, through the adl-go bindings. `encoding/json` does not round
trip the generated unions.

| request    | response    | what it does                                |
|------------|-------------|---------------------------------------------|
| `list`     | `list`      | every calculation, in the order made        |
| `get`      | `got`       | one calculation by id                       |
| `put`      | `put`       | create or update; the response has the id   |
| `delete`   | `deleted`   | forget a calculation                        |
| `parse`    | `parsed`    | the AST and the printed form                |
| `evaluate` | `evaluated` | the value and the printed form              |
| any        | `error`     | the message; the line and column of a parse |

An `Engine` is not safe for concurrent use. It holds the list in
memory, and the grammar holds its current input.

## 6. The two entries

**The worker.** `wasm/main.go` builds for `js/wasm`. It makes one
grammar and one engine over the seeded memory store. Then it puts
`calcRequest` on the JavaScript global, a function from a request's
JSON to a response's JSON, and blocks. `task calc:wasm` writes
`calc.wasm` and `wasm_exec.js` to `web/packages/client/wasm/`.

**The server.** `services/bff` makes one grammar and one engine over
the file store, and answers `POST /api/calc` under one mutex. An
engine error is a `200` that carries the `error` branch. A transport
failure, a `405`, `413` or `400`, is plain text. The API is
single-tenant, and correct on loopback only; `services/bff/AGENTS.md`
gives the rule.

**The command.** `clis/calc` reads an expression on standard input
and a binding per `-b`. It calls `ast` and `eval` directly, with no
store, and writes the value and the printed form.

## 7. The two transports

The page reaches the engine through one of two transports, and nothing
above the transport knows which. `web/packages/client` holds both.

```
  App.tsx ──► Engine (engine.ts: list, get, put, delete, parse, evaluate)
                │
                ▼
          TypedEngine ──► LoggingTransport (log.ts) ──► Transport
                                                          │
            offline:   WorkerTransport ──postMessage──► worker.ts ──► calcRequest   (calc.wasm)
            connected: HttpTransport   ──POST /api/calc──► bff ──► engine.HandleJSON
```

| file              | role                                                              |
|-------------------|-------------------------------------------------------------------|
| `factory.ts`      | `createEngine(config, log)`: the one place that picks a transport |
| `workerEngine.ts` | `WorkerTransport`: an envelope per request, matched by its id     |
| `worker.ts`       | the Web Worker: loads `calc.wasm`, answers each envelope in order |
| `http.ts`         | `HttpTransport`: one `POST` per request; `TransportError`         |
| `direct.ts`       | the engine in the same thread, for the tests under node           |
| `log.ts`          | `RequestLog`: every message, both modes; a recording taps it      |
| `engine.ts`       | `TypedEngine`: one method per request; the error branch is thrown |
| `protocol.ts`     | the ADL JSON bindings of `api.Request` and `api.Response`         |

**The mode.** `readEngineConfig` in `web/apps/app/src/engineConfig.ts`
reads the URL, then `GET /api/config`. `?offline` is offline, and
`?api=<url>` is connected to that URL. With neither, `api: true` in
the config is connected to `/api/calc`. A server with `--api=false`,
and Vite's dev server, which has no config, are offline.

**The wire.** Both transports carry the same text: an `api.Request`
as ADL JSON in, an `api.Response` as ADL JSON out. An engine error is
the `error` branch in both. `TypedEngine` throws it as an
`EngineError`, with `at` for a parse error. A failure of the
transport itself, a refused fetch or a status that is not `200`, is a
`TransportError`, and the page says it on the status line.

**The store.** The worker's engine has the memory store, seeded with
three calculations, and loses its changes on reload; the offline
status line says so. The server's engine has the file store under
`--store`. Section 4 has both.
