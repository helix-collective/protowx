# syntax=docker/dockerfile:1.7
#
# The images of the compose stack: one build stage per service in the
# flake's `build` shell, and one target per service. README.md beside
# this file is how to run it.
#
# The context is the repository root, and nothing beside it: go.work
# has no replace, so the build takes adl-go and ohm-go from the proxy.
#
# Two services today, bff and myw. The trace viewer, Jaeger, joins with
# the traces; it is pulled, not built, so it has no stage here.

# ---- the dev shell -------------------------------------------------
# The flake alone, so a change to the source does not fetch the shell
# again. The flake reads no other file of the repository. The `build`
# shell has the tools the tasks call and no more: no browsers and no
# git hooks.
FROM nixos/nix:2.35.3 AS shell
ENV NIX_CONFIG="experimental-features = nix-command flakes"
COPY flake.nix flake.lock /flake/
RUN nix develop /flake#build --command true
# The shell's adlc, which task calc:adl-ts calls, is the upstream binary
# release, not a Nix build: it names /lib64/ld-linux-x86-64.so.2 and
# links libgmp from the host. nixos/nix has neither, so give it both,
# from the flake's own nixpkgs. Nothing else in the build reads them.
RUN glibc=$(nix build --no-link --print-out-paths --inputs-from /flake nixpkgs#glibc.out) \
 && gmp=$(nix build --no-link --print-out-paths --inputs-from /flake nixpkgs#gmp.out) \
 && mkdir -p /lib64 \
 && ln -s "$glibc/lib/ld-linux-x86-64.so.2" /lib64/ld-linux-x86-64.so.2 \
 && echo "$gmp/lib" > /etc/adlc-libs

# ---- the workspace -------------------------------------------------
# What every build reads and seldom changes: go.work, each module's
# go.mod and go.sum, and each Taskfile. go wants a go.mod in each
# directory that go.work uses, and task reads every included Taskfile,
# so each build has all of them. Each build stage below then copies
# only its own source, so a change to one service builds that service
# alone.
FROM shell AS workspace
WORKDIR /src/protowx
COPY go.work Taskfile.yml ./
COPY engine/go.mod engine/go.sum engine/Taskfile.calc.yml engine/
COPY clis/go.mod clis/go.sum clis/
COPY services/bff/go.mod services/bff/go.sum services/bff/Taskfile.bff.yml services/bff/
COPY services/myw/go.mod services/myw/go.sum services/myw/Taskfile.myw.yml services/myw/
COPY web/Taskfile.web.yml web/
# Every Taskfile the root one includes, or task refuses to read any of
# them: "No Taskfile found at ...". A new include in Taskfile.yml is a
# new line here, even for a stack that this image never runs.
COPY deploy/compose/Taskfile.compose.yml deploy/compose/
COPY deploy/ngrok/Taskfile.ngrok.yml deploy/ngrok/

# ---- bff's build ---------------------------------------------------
# The tasks a developer runs, in the same shell. bff needs the page:
# task web:build makes calc.wasm, the TypeScript types and dist/, from
# spec/ and engine/. CGO_ENABLED=0 makes bff static. /out/store is the
# file store's directory, open to any uid: compose.yaml runs bff as
# the host's user, and its volume starts from this directory.
FROM workspace AS build-bff
COPY spec spec
COPY engine engine
COPY services/bff services/bff
COPY web web
RUN --mount=type=cache,target=/root/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/root/.local/share/pnpm/store \
    nix develop /flake#build --command sh -euc ' \
      export CGO_ENABLED=0; \
      task web:install; \
      export LD_LIBRARY_PATH=$(cat /etc/adlc-libs); \
      task web:build bff:build; \
      mkdir -p /out/store; \
      chmod 1777 /out/store; \
      cp services/bff/bff /out/bff; \
      cp -r web/apps/app/dist /out/dist \
    '

# ---- myw's build ---------------------------------------------------
# It imports no other module of the workspace. It stays dynamic: kronk's
# bindings dlopen whisper.cpp and libffi, so it needs the Nix loader and
# their closures, which this step copies out with it. The model
# directory is a cache, so task myw:model downloads the model once and
# its hash check skips it after.
FROM workspace AS build-myw
COPY services/myw services/myw
RUN --mount=type=cache,target=/root/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/src/protowx/services/myw/source/model \
    nix develop /flake#build --command sh -euc ' \
      export CGO_ENABLED=0; \
      task myw:build; \
      mkdir -p /out/opt /out/nix/store /out/cache /out/tmp; \
      cp services/myw/myw /out/myw; \
      loader=$(readelf -l services/myw/myw | sed -n "s/.*interpreter: \(.*\)]/\1/p"); \
      cp -a $(nix-store -qR "$(echo "$loader" | cut -d/ -f1-4)" "$(dirname "$PROTOWX_WHISPER_LIBS")" "$(dirname "$PROTOWX_LIBFFI")") /out/nix/store/; \
      ln -s "$PROTOWX_WHISPER_LIBS" /out/opt/whisper; \
      ln -s "$PROTOWX_LIBFFI" /out/opt/libffi; \
      chmod 1777 /out/cache /out/tmp \
    '

# ---- bff: the page, the engine API, the feedback report ------------
FROM scratch AS bff
COPY --from=build-bff /out/ /app/
ENTRYPOINT ["/app/bff", "--dir", "/app/dist", "--store", "/app/store/calculations.json"]

# ---- myw: My Whisper, the dictation's transcription service --------
# The model is in the binary, -tags embedmodel. The service writes it to
# the cache directory at the first request. The binary reads its libs
# from PROTOWX_WHISPER_LIBS, its --libs flag; kronk opens libffi from
# LD_LIBRARY_PATH, and panics at start without it.
FROM scratch AS myw
COPY --from=build-myw /out/ /
ENV PROTOWX_WHISPER_LIBS=/opt/whisper \
    LD_LIBRARY_PATH=/opt/libffi \
    OMP_WAIT_POLICY=passive \
    XDG_CACHE_HOME=/cache \
    HOME=/tmp \
    TMPDIR=/tmp
ENTRYPOINT ["/myw", "serve"]
