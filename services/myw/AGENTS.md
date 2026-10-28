# myw

My Whisper, the dictation's transcription service: whisper.cpp inside
a Go binary through [kronk](https://github.com/ardanlabs/kronk), with
the model in the binary. The page talks to it directly, told its URL
by `bff` at `GET /api/config`. [README.md](README.md) is how to run it
and what it measured;
[docs/features/001-calculator/prd.md](../../docs/features/001-calculator/prd.md)
section 5 is the design.

| directory          | role                                                             |
|--------------------|------------------------------------------------------------------|
| `main.go`          | the opts CLI: `serve`, `transcribe` and `stream`                 |
| `servecmd/`        | `serve`: the flags, the listener, the CORS allowlist             |
| `server/`          | the routes, the live streams, CORS, the model behind one mutex   |
| `lean/`            | kronk's model package alone: load the libraries and the model    |
| `source/`          | the options, and the built-in model written to the cache         |
| `transcribecmd/`   | one file in, the segments out as JSON                            |
| `streamcmd/`       | one file played into a stream in slices, the events as lines     |
| `testdata/`        | `narration.wav`: 7.13 s of synthetic speech, 16 kHz mono         |
| `Taskfile.myw.yml` | `model`, `build`, `run`, `serve`, `transcribe`, `stream`, `test` |

- **It is its own module**, and it stays one: the page reaches it
  over HTTP, and `bff` imports nothing of kronk. `lean` is the 35
  packages the model needs.
- **It knows nothing of the page.** Bytes in, text out. It writes no
  file and does not know `.bugreports/`. The page puts the words in
  the text.
- **It has no tailnet node.** It has no `tailnet/` and no
  `--tailnet` flags. In the stack, the tailscale
  container is the one way onto the tailnet, and the page's origin
  there is an `--origin`.
- **A live stream is one span.** `server/live.go` keeps the stream's
  samples while it is open, and the `DELETE` transcribes them whole.
  The stream and the model are interfaces, `Stream` and `Streamer`, so
  `live_test.go` runs on a fake without libffi or the model. A stream
  fed nothing for 30 s is closed; its events end with `end`.
  **dictate** posts one WAV to `/transcribe` and opens no stream.
- **CORS is the guard in the browser, and the only one.** The service
  is unauthenticated. `server/cors.go` refuses an `Origin` not on the
  allowlist before it reads a body, and never answers `*`. A request
  with no `Origin`, a `curl`, passes.
- **A package that imports kronk cannot start without `libffi.so.8`**:
  its bindings open it in an `init`. `source` and `servecmd`'s test
  import nothing of kronk; `server`'s test does, through
  `model.Decode`. Run the tests through `task myw:test`, which puts
  libffi on `LD_LIBRARY_PATH`.
- **Set `OMP_WAIT_POLICY=passive` before the process starts.** A Go
  `os.Setenv` does not reach libgomp. The tasks set it.
- **The model is never committed.** `task myw:model` downloads it to
  `source/model/` and checks its SHA-256; `.gitignore` keeps it out,
  and the built binary too.

```sh
task myw:serve        # the service on 127.0.0.1:8090, for task bff:connected
task myw:test         # go test and vet; the transcription tests need the model
task myw:transcribe   # the fixture's segments as JSON
task myw:stream       # the fixture played into a live stream
```
