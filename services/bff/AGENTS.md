# services/bff

The repo-wide rules are in the root `AGENTS.md`. This file covers the
server, the Go module `bff`.

A `jpillora/opts` CLI that serves the page's `dist/` and answers the
engine protocol at `POST /api/calc`. It imports `engine` through
`go.work`. [docs/architecture/engine.md](../../docs/architecture/engine.md)
is the engine behind the route.

| file           | role                                                          |
|----------------|---------------------------------------------------------------|
| `main.go`      | the flags, the mux, the graceful stop                         |
| `server.go`    | the static handler: the fallback, the cache headers, the log  |
| `engine.go`    | `POST /api/calc`: one engine behind one mutex                 |
| `store.go`     | the file store under `--store`: `Load` at start, `Save` whole |
| `bugreport.go` | `POST /api/bugreport`, `/screenshot`, `/audio`: `--bugs`      |
| `config.go`    | `GET /api/config`: `myw`, `bugs`, `api`                       |
| `myw.go`       | `--myw-url`                                                   |
| `browser.go`   | `--open`                                                      |

`traces.go`, `--otlp-url` and `--trace-view-url` come with the traces.

```sh
task bff:test
task bff:connected          # the page on this engine, in a browser
task bff:offline            # the page on the wasm engine; --api=false
go run . --help             # in services/bff
```

## The rules

- **The engine API is single-tenant and only correct on loopback.** One
  engine, one store, one mutex: any caller reads, changes or deletes
  any calculation. `--addr` defaults to `127.0.0.1:8080`. Sessions
  come before a wider bind. Anything that deploys `bff` for anyone
  else turns the API off with `--api=false`, which leaves a static
  server and the report routes.
- **An engine error is a 200** that carries the protocol's `error`
  branch; the page shows it beside its part. Only `405`, `413` and
  `400` are transport failures, in plain text, which the page shows as
  "not connected". Keep that split.
- **The store is written whole.** Each `put` and `delete` writes the
  whole `model.Store` to a temporary file beside `--store`, then
  renames it over the file. A write that fails is an `error` response,
  and the engine keeps the list as it was. A missing file starts from
  the three seeded calculations; a file that does not decode stops
  `bff` at start.
- **The report routes write files, so the server names them.** The
  title reaches a file name only through `slug`, which keeps
  `[a-z0-9-]`. Nothing the client sends is used as a path. The
  screenshot route writes a body only when it starts with the PNG
  signature, and the audio route only a RIFF WAVE file. The routes are
  not under `--api`, so the offline page sends a report too, and they
  are as loopback-only as the engine API. `--bugs=` turns them off, as
  a `404` for every method.
- **Every route is registered by path, not by method.** A wrong method
  then gets a `405`, and never falls through to the static handler's
  `index.html`.
- **The grammar lives as long as the server.** `ohm.Grammar` matches
  under the context it was made with, so the engine is made with the
  server's context, never a request's.
