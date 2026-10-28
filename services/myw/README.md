# myw: My Whisper, the dictation's transcription service

whisper.cpp in Go, through kronk, as a service the page talks to. It
turns the speech of **dictate** into words,
[docs/features/001-calculator/prd.md](../../docs/features/001-calculator/prd.md)
section 5. The model is in the binary, and there is no `whisper-cli`
on the `PATH` and no cgo. It has no tailnet node.

```sh
task myw:model        # the model, 142 MB, once; the hash is checked
task myw:serve        # the service on 127.0.0.1:8090
task myw:transcribe   # the fixture's segments, as POST /transcribe answers them
task myw:stream       # the fixture played in real time, each partial and final
task myw:test
```

`task myw:serve` and `task bff:connected -- --myw-url
http://127.0.0.1:8090` on one machine is the whole setup on loopback:
`bff` tells the page the URL at `GET /api/config`, the page draws
**dictate**, and the service lets `bff`'s two loopback origins in. A
`bff` on another address is an `--origin`:

```sh
task myw:serve -- --origin http://127.0.0.1:9000
task bff:connected -- --addr 127.0.0.1:9000 --myw-url http://127.0.0.1:8090
```

The service has no tailnet node of its own. In the stack, the
tailscale container is the one way onto the tailnet.

## The service

`myw serve` answers six routes, and knows nothing of the page, of
reports or of `.bugreports/`:

| route                   | does                                                      |
|-------------------------|-----------------------------------------------------------|
| `GET /healthz`          | `ok base.en`: the page's probe, and the model's name      |
| `POST /transcribe`      | a RIFF WAVE body in, the segments out as JSON; 64 MiB cap |
| `POST /live`            | opens a live stream; answers `{ "id" }`                   |
| `POST /live/{id}`       | a slice of 16 kHz 16-bit little-endian samples; 1 MiB cap |
| `GET /live/{id}/events` | Server-Sent Events: `partial`, `final`, then `end`        |
| `DELETE /live/{id}`     | closes the stream, answers the whole span's segments      |

A segment is `{ "from", "to", "text" }`, milliseconds into the audio it
was given:

```json
[{ "from": 0, "to": 2400, "text": " And now I rename the group R0 to GRP." }]
```

A body that is not RIFF WAVE is a 400. The transcription runs under the
request's context with a ten-minute limit, and the server has no write
timeout, so the request waits for it. A failure is a 500 with the
message as the body, which the page says on the status line.
**dictate** posts one WAV to `POST /transcribe` at the second click. The model loads at the first request,
not at startup, and one transcription runs at a time.

**The live streams** are for a narration that is written while it is
spoken: one stream per span. The page's `transcribeClient.ts` has the
client; **dictate** does not use it. `POST /live` opens one on the loaded model, with a
partial every 700 ms, and answers its id. `POST /live/{id}` takes a
slice of raw samples, feeds it to kronk's stream and keeps a copy; the
page posts about 250 ms at a time. `GET /live/{id}/events` is SSE: an
event `partial` or `final` carries `{ "from", "to", "text" }`,
milliseconds into the stream, with `[BLANK_AUDIO]` dropped, and `end`
comes once the stream is closed; a reconnect with `Last-Event-ID`
reads on from there. `DELETE /live/{id}` closes the stream,
transcribes the kept samples whole, answers their segments, and
forgets the stream: the client gets whole sentences, and the service
is not sent the WAV as well. A stream fed nothing for 30 s is closed by
the service: its events end with `end`, a feed after it is a 409, and
its samples wait ten minutes for the `DELETE`. An unknown id is a 404.
kronk's state pool holds two states, so an open stream and a
whole-file pass do not wait on each other.

```sh
ID=$(curl -s -X POST http://127.0.0.1:8090/live | jq -r .id)
curl -s -N http://127.0.0.1:8090/live/$ID/events &     # the events, as they come
tail -c +45 testdata/narration.wav | \
  curl -s -X POST --data-binary @- -H 'Content-Type: application/octet-stream' http://127.0.0.1:8090/live/$ID
curl -s -X DELETE http://127.0.0.1:8090/live/$ID          # the whole span's segments
```

| flag        | default          | does                                                  |
|-------------|------------------|-------------------------------------------------------|
| `--addr`    | `127.0.0.1:8090` | the listener                                          |
| `--origin`  | none             | a page origin CORS lets in, repeatable                |
| `--libs`    | the shell's      | whisper.cpp's `lib` directory, `PROTOWX_WHISPER_LIBS` |
| `--model`   | the built-in     | a ggml model file in place of the embedded one        |
| `--cache`   | the user cache   | where the built-in model is written once              |
| `--threads` | `2`              | decode threads; more is slower on a busy machine      |
| `--quiet`   | off              | no request log                                        |
| `--timeout` | `5s`             | the grace for requests in flight at a stop            |

`--addr` and `--origin` read `MYW_ADDR` and `MYW_ORIGIN` from the
environment, and `--libs` reads `PROTOWX_WHISPER_LIBS`.

**CORS.** The page is another origin, so the service names the origins
it lets in and refuses every other before it reads a body. The list is
`http://127.0.0.1:8080` and `http://localhost:8080` always, the
origins of `bff`'s default `--addr`, and each `--origin`.
The log prints the list at startup, and each refused request as a 403.
The list is never `*`: the service is unauthenticated, and `*` would
let any page in the user's browser post audio to it and read the text
back. A request with no `Origin` header, a `curl`, passes: CORS guards
browsers, not processes.

```sh
curl -s --data-binary @testdata/narration.wav \
  -H 'Content-Type: audio/wav' http://127.0.0.1:8090/transcribe
```

## What kronk is here

[kronk](https://github.com/ardanlabs/kronk), from Ardan Labs, Apache-2.0,
is a Go SDK over native inference engines. Its speech side, `sdk/bucky`,
runs [whisper.cpp](https://github.com/ggml-org/whisper.cpp) through
[ardanlabs/bucky](https://github.com/ardanlabs/bucky), which calls the
shared libraries with purego and libffi. There is no cgo:
`CGO_ENABLED=0 go build` works. It does a whole file, `Transcribe`, and a
live stream, `NewStream`, `Feed` and `Events`, which gives partials that
are rewritten and finals that are kept. This service uses kronk v1.32.9,
bucky v1.1.4.

Only kronk's model package, `sdk/bucky/model`, is linked: `lean`
loads the shell's whisper.cpp and the built-in model through it, with
35 packages under it. The prototype also had `engine`, kronk's
`sdk/bucky` with its download tools, its catalog, `go-getter` with the
AWS and Google Cloud SDKs, and yzma's llama bindings: 708 packages,
for nothing the dictation needs. That code is deleted, and `go mod tidy`
dropped 338 packages from the binary's dependency list. A copy with a
tailnet node has tsnet too, 362 packages; this one has not. Of the packages outside
the standard library that are left, 51 are the HTTP side with the
model, and 35 the model alone.

## The model in the binary

`task myw:build` downloads `ggml-base.en.bin`, 142 MB, checks its
SHA-256, and builds with `-tags embedmodel`, which embeds it
(`source/embed.go`). The binary is then 213 MB, against 65 MB without.
whisper.cpp reads a model from a file, so the first load writes the bytes
to the user cache under their hash, `~/.cache/protowx/whisper/`, and later
loads find the file. That write is 0.6 s once.
`bucky/pkg/whisper` also has `InitFromBufferWithParams`, which loads from
memory, but kronk's `model.NewModel` takes a path only.

## What it needs at run time

- **libffi.** `jupiterrider/ffi` opens `libffi.so.8` in an `init`, so a
  binary that imports kronk's model package panics at startup without it,
  before any flag is read. The Taskfile puts the shell's libffi on
  `LD_LIBRARY_PATH`. Most Linux distributions and macOS have it; NixOS has
  it on no default path.
- **whisper.cpp's libraries.** `--libs` names them: the dev shell's
  `whisper-cpp` (1.9.2) from nixpkgs, built without SDL or ffmpeg, 86
  MiB in place of 986, and exported as `PROTOWX_WHISPER_LIBS`. kronk
  pins 1.9.5, and 1.9.2 worked for every call here. kronk's own download
  is an Ubuntu build that also needs `libstdc++.so.6` and `libgomp.so.1`
  from the system.
- **`OMP_WAIT_POLICY=passive`.** whisper.cpp's OpenMP threads spin while
  they wait. On this machine, 4 vCPUs at a load of 3.9, four spinning
  threads took 22.6 s for the fixture, and two took 1.3 s. libgomp reads
  the variable when it loads, and a pure Go `os.Setenv` does not reach the
  C environment, so it is set before the process starts.

## How the libraries and the model are pinned

Four native or downloaded parts meet in a run. Each is pinned, by a
different file:

| part                 | from                  | pinned by                            | arrives as                      |
|----------------------|-----------------------|--------------------------------------|---------------------------------|
| whisper.cpp 1.9.2    | nixpkgs `whisper-cpp` | `flake.lock`, the `nixpkgs` revision | built from source, once         |
| libffi 3.8.0         | nixpkgs `libffi.out`  | the same revision                    | a download from cache.nixos.org |
| ggml-base.en, 142 MB | huggingface.co        | `MODEL_SHA256` in the Taskfile       | `curl`, once, then checked      |
| kronk, bucky, ffi    | the Go module proxy   | `go.mod` and `go.sum`                | `go build`                      |

**The libraries are in the flake.** `flake.nix` adds
`whisper-cpp.override { withSDL = false; withFFmpegSupport = false; }`
and `libffi` to the dev shell, and exports their `lib` directories as
`PROTOWX_WHISPER_LIBS` and `PROTOWX_LIBFFI`. The Taskfile reads the two
variables first. Outside the shell it builds the packages itself:

```sh
nix build --no-link --print-out-paths --inputs-from ../.. nixpkgs#whisper-cpp
```

`--inputs-from ../..` makes `nixpkgs` mean this flake's locked input, the
revision in `flake.lock`, and not the registry's unpinned `nixpkgs`. The
store path is a hash of the package's inputs, so the same lock gives the
same path on every machine. The stock `whisper-cpp` is in
cache.nixos.org; the override is not, so it is built from the same
pinned source, `v1.9.2.tar.gz` with its hash in nixpkgs, once per
machine, and it is as reproducible, only slower the first time.

**What moves them.** `nix flake update` bumps `nixpkgs`, and both
libraries move with the Go toolchain and everything else. Nothing here
pins 1.9.2 itself, and no test reads the version. The transcription
tests are the check: kronk binds whisper.cpp 1.9.5 by name, and a call
whose arguments changed would fail there, not at the load.

**What escapes the pin.** `PROTOWX_WHISPER_LIBS` and `PROTOWX_LIBFFI`
set by hand point anywhere. A `nix build` that fails outside the shell
is seen: the Taskfile no longer hides its stderr. `LD_LIBRARY_PATH`
names a directory, and the binary opens `libffi.so.8` by its soname, so
any libffi with that soname works, pinned or not.

**The model is pinned by its hash, outside Nix.** The Taskfile downloads
`ggml-base.en.bin` from huggingface.co and refuses it unless its SHA-256
is the one written in `MODEL_SHA256`. The URL is not under this repo's
control, and the download needs the network, but a changed file cannot
get in. A `fetchurl` in `flake.nix` with the same hash would make it a
store path and a substitute, which is the step to take if the download
ever fails or the model is wanted offline.

**How reproducible is the build.** The Go binary is built by the
flake's `go` from `go.mod` and `go.sum`, so its code is the same on every
machine; `go build` without `-trimpath` embeds the build directory, so
two checkouts in two paths differ in that string alone. The embedded
model is byte-identical by the hash check. The binary holds no copy of
whisper.cpp or libffi: it opens them at run time from the paths it is
given, so the build is reproducible, and the run is reproducible as far
as `flake.lock` reaches, which is the Taskfile and the dev shell, and
no further.

## Measured

The fixture is `testdata/narration.wav`: 7.13 s of synthetic speech.
It was measured on an Intel Xeon Platinum 8488C, 4 vCPUs, busy:

| what                            | model   | threads     | time   |
|---------------------------------|---------|-------------|--------|
| load, from the cache            | base.en |             | 0.25 s |
| transcribe 7.13 s               | base.en | 2           | 1.0 s  |
| transcribe 7.13 s               | base.en | 1           | 1.9 s  |
| transcribe 7.13 s               | base.en | 4, spinning | 22.6 s |
| transcribe 7.13 s               | base.en | 4, passive  | 1.6 s  |
| stream: first final after words | base.en | 2           | ~2.5 s |
| stream: last final after close  | base.en | 2           | ~1.1 s |

`base.en` heard "And now I rename the group R0 to GRP. The cell should move
with the group. It stayed where it was." `tiny.en` heard "Now I rename the
Ru Pāxirō to Giabī", so it is not an option. The stream's partials come
about every 2 s under that load, and an early one on under a second of
audio was "I'll have a good day.": a partial is a guess, and a final is
what to keep. A silence comes back as `[BLANK_AUDIO]`.

## Layout

| path               | what                                                             |
|--------------------|------------------------------------------------------------------|
| `main.go`          | the opts CLI: `serve`, `transcribe` and `stream`                 |
| `servecmd/`        | `serve`: the flags, the listener, the CORS allowlist             |
| `server/`          | the routes, the live streams, CORS, the model behind one mutex   |
| `source/`          | the options, and the built-in model written to the cache         |
| `lean/`            | kronk's model package alone, and `Decode`                        |
| `transcribecmd/`   | one file in, the segments out as JSON                            |
| `streamcmd/`       | one file played into a stream in slices, the events as lines     |
| `testdata/`        | `narration.wav`, the fixture the tests and the tasks play        |
| `Taskfile.myw.yml` | `model`, `build`, `run`, `serve`, `transcribe`, `stream`, `test` |
