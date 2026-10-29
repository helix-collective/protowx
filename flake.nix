{
  description = "protowx, said \"proto works\": a starter for the nix, ADL, Ohm, Go and SolidJS stack";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  # The Markdown formatter and the prompt-history recorder, the four
  # commands the git hooks run. `follows` makes one nixpkgs build both
  # flakes, so there is one Go toolchain in the closure.
  inputs.repo-tools.url = "github:wxio/repo-tools";
  inputs.repo-tools.inputs.nixpkgs.follows = "nixpkgs";

  # ohm-cli, from the source of ohm-go: the grammar test runner,
  # `ohm-cli test txtar`, over spec/ohm-cli/tests. Its flake
  # exports no package, so this one builds the binary from the pinned
  # source. The input follows the tag ohm-cli/v1.1.0, not main: main
  # has no --strict and no error kind, which task calc:grammar-test
  # needs. Move the ref to a newer tag, then `task nix:update-ohm-cli`.
  # OHM_GO_DEV in .envrc builds a local checkout instead, with the
  # shell's Go; see mkOhmCliLocal.
  inputs.ohm-go.url = "github:ohmjs/ohm-go?ref=ohm-cli/v1.1.0";
  inputs.ohm-go.flake = false;

  outputs = { self, nixpkgs, repo-tools, ohm-go }:
    let
      # The four platforms anyone here is plausibly on. Listed rather than
      # pulled from flake-utils: one fewer input to keep current, and the set
      # is short enough to read.
      systems = [ "aarch64-darwin" "x86_64-darwin" "aarch64-linux" "x86_64-linux" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});

      # Which repo-tools the shell holds, for the banner. A git input
      # has a `rev`; the `path:` input that `--override-input` puts there
      # has none, which is how the two modes tell themselves apart.
      toolsSource =
        if repo-tools ? rev
        then "pinned ${builtins.substring 0 7 repo-tools.rev}"
        else "LOCAL, from REPO_TOOLS_DEV";

      # Which ohm-go the shell builds ohm-cli from, for the banner, told
      # apart the same way: the `path:` input from OHM_GO_DEV has no rev.
      ohmRev = if ohm-go ? rev then builtins.substring 0 7 ohm-go.rev else "local";
      ohmSource =
        if ohm-go ? rev
        then "pinned ${ohmRev}"
        else "LOCAL, from OHM_GO_DEV, built with go through its go.work";

      # The ADL compiler, from the upstream binary release. Only two of our
      # four platforms have a published build, so the shell drops it on the
      # other two rather than failing to evaluate there.
      adlPlatforms = [ "aarch64-darwin" "x86_64-linux" ];

      # whisper.cpp's shared libraries, for services/myw, which calls
      # them through kronk's bindings. Without SDL and ffmpeg, which are
      # for examples nobody here runs: 86 MiB in place of 986. The
      # override is not in cache.nixos.org, so it is built from the pinned
      # source once per machine. services/myw/README.md has the numbers.
      mkWhisper = pkgs: pkgs.whisper-cpp.override {
        withSDL = false;
        withFFmpegSupport = false;
      };

      mkAdl = pkgs: pkgs.callPackage
        ({ stdenv, fetchurl, unzip }:
          let
            version = "1.2.3";
            src = fetchurl (
              if stdenv.hostPlatform.isDarwin && stdenv.hostPlatform.isAarch64 then {
                url = "https://github.com/adl-lang/adl/releases/download/v${version}/adl-bindist-${version}-macos-arm64.zip";
                sha256 = "sha256-IAdm+tWqRwkoCWfMn69KIdG6rAztRU+aZDQTGGWfZJY=";
              } else if stdenv.hostPlatform.isLinux && stdenv.hostPlatform.isx86_64 then {
                url = "https://github.com/adl-lang/adl/releases/download/v${version}/adl-bindist-${version}-linux-x64.zip";
                sha256 = "sha256-5V/RU8LV78NkcE3pu9fkMvbjb184QYO33MjqRtlQPJE=";
              } else
                throw "adl: unsupported platform ${stdenv.hostPlatform.system}, only macos-arm64 and linux-x64 are available"
            );
          in
          stdenv.mkDerivation {
            pname = "adl";
            inherit version src;

            nativeBuildInputs = [ unzip ];
            sourceRoot = ".";

            installPhase = ''
              mkdir -p $out/bin $out/lib
              cp bin/adlc $out/bin/
              cp -r lib/* $out/lib/
              chmod +x $out/bin/*
            '';

            meta = {
              description = "Helix ADL tool";
              platforms = adlPlatforms;
            };
          })
        { };

      # md-tmpl, which rewrites a Markdown block with the output of the
      # command in its tag. The plan-report hook runs it over
      # docs/features/README.md. It is not in nixpkgs, so it is built
      # from its tag. Bump `version` and both hashes together: set each
      # to `lib.fakeHash` in turn and read the right one off the build.
      mkMdTmpl = pkgs: pkgs.buildGoModule rec {
        pname = "md-tmpl";
        version = "1.3.0";

        src = pkgs.fetchFromGitHub {
          owner = "jpillora";
          repo = "md-tmpl";
          rev = "v${version}";
          hash = "sha256-kOM6lUpb1ed0jFeMChpYKwRsiqUnWqe4moBUn45XDiU=";
        };

        vendorHash = "sha256-W3dnH4BoIDOCJY4uIyHQslRt4YgsAgCnZPkEexajqhk=";

        meta = {
          description = "Markdown templating with shell commands";
          homepage = "https://github.com/jpillora/md-tmpl";
          mainProgram = "md-tmpl";
        };
      };

      # ohm-cli, built from the ohm-go input above, module ohm-cli of
      # its workspace, with the shell's Go, since its go.mod asks for
      # 1.27. GOWORK is off, so the repository's go.work does not reach
      # into the vendor step: ohm-cli builds against the ohm module its
      # go.mod requires, from the proxy. The version is the input's
      # commit. `task nix:update-ohm-cli` sets vendorHash when the input
      # moves. This is the pinned mode only; a checkout from OHM_GO_DEV
      # goes through mkOhmCliLocal.
      mkOhmCli = pkgs: (pkgs.buildGoModule.override { go = pkgs.go_1_27; }) {
        pname = "ohm-cli";
        version = "0-unstable-${ohmRev}";
        src = ohm-go;
        modRoot = "ohm-cli";
        vendorHash = "sha256-hK3uCRHND5ETO+WwDAQ1MxC8mtmgUTKBu3xgWlrO3fI=";
        env.GOWORK = "off";
        doCheck = false;

        meta = {
          description = "The Ohm grammar toolchain's CLI: generate, and test txtar";
          homepage = "https://github.com/ohmjs/ohm-go";
          mainProgram = "ohm-cli";
        };
      };

      # ohm-cli from a checkout, OHM_GO_DEV. mkOhmCli cannot build one:
      # it vendors with `go mod vendor` under GOWORK=off, so ohm-cli
      # sees the published ohm module, not the checkout's ohm/, and a
      # change there fails the build with "undefined: ohm.X". A vendor
      # of the workspace would need a vendorHash that moves with every
      # go.sum of the checkout. So the shellHook builds the checkout
      # with the shell's Go, through the checkout's go.work, which joins
      # ohm-cli to ohm/. Go's module cache and build cache serve it, so
      # there is no hash. The binary goes to a cache directory, so
      # neither tree changes. `direnv reload` builds the working tree
      # again; a build without changes takes under a second.
      mkOhmCliLocal = ''
        ohm_cli_bin="''${XDG_CACHE_HOME:-$HOME/.cache}/protowx/ohm-cli"
        mkdir -p "$ohm_cli_bin"
        if GOWORK=${ohm-go}/go.work go build -C ${ohm-go}/ohm-cli -o "$ohm_cli_bin/ohm-cli" .; then
          export PATH="$ohm_cli_bin:$PATH"
        else
          echo "ohm-cli: the build from OHM_GO_DEV failed, so no ohm-cli is on PATH" >&2
        fi
        unset ohm_cli_bin
      '';

      # The tools the build tasks call, and no more: the toolchains, the
      # ADL compiler, and the libraries of services/myw. The `build`
      # shell is these alone; the compose images build in it, so a tool
      # for a developer does not fill the Docker disk.
      mkBuildPackages = pkgs: with pkgs; [
        go_1_27
        go-task
        # web/ is a pnpm workspace; package.json's engines field pins the
        # same majors.
        nodejs_24
        pnpm_12
        # whisper.cpp's libraries and libffi, for services/myw. kronk's
        # bindings open libffi.so.8 when the process starts, and NixOS
        # has it on no default path. The shellHook exports both lib
        # directories; the myw tasks read them.
        (mkWhisper pkgs)
        libffi
      ] ++ nixpkgs.lib.optional
        (builtins.elem pkgs.stdenv.hostPlatform.system adlPlatforms)
        (mkAdl pkgs);

      # whisper.cpp's libraries and libffi, for services/myw. The
      # Taskfile reads these first, and builds the packages itself when
      # they are unset.
      mkBuildHook = pkgs: ''
        export PROTOWX_WHISPER_LIBS=${mkWhisper pkgs}/lib
        export PROTOWX_LIBFFI=${pkgs.libffi.out}/lib
      '';
    in
    {
      devShells = forAllSystems (pkgs: {
        # The compose images build here: deploy/compose/Dockerfile. No
        # browsers, so `task web:test` does not run in it.
        build = pkgs.mkShell {
          name = "protowx-build";
          packages = mkBuildPackages pkgs;
          shellHook = ''
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            ${mkBuildHook pkgs}
          '';
        };

        default = pkgs.mkShell {
          name = "protowx";

          packages = mkBuildPackages pkgs ++ (with pkgs; [
            # The git hook runner. `prek install` wires .pre-commit-config.yaml
            # into .git/hooks; `prek run -a` runs the hooks by hand.
            prek
            # The Markdown block rewriter the plan-report hook runs.
            (mkMdTmpl pkgs)
            # Chromium, Firefox and WebKit, for the ui-browser vitest
            # project. 415 MiB to fetch and 1.1 GiB in the store, once per
            # machine, which is the price of `task web:test` needing nothing
            # installed by hand. The npm `playwright` package is pinned to
            # this derivation's version in web/packages/ui/package.json
            # and refuses these browsers if the two ever drift apart, so the
            # shellHook prints the version to pin to.
            playwright-driver.browsers
            # The GitHub CLI, for pull requests and workflow runs.
            gh
            # The Markdown formatter and the prompt-history recorder: the
            # four commands prek.toml and .claude/settings.json call, from
            # wxio/repo-tools and pinned by flake.lock.
            # `nix flake update repo-tools` bumps them.
            repo-tools.packages.${pkgs.stdenv.hostPlatform.system}.default
          ]) ++ nixpkgs.lib.optional (ohm-go ? rev)
            # ohm-cli, for `task calc:grammar-test`, from the ohm-go
            # input and pinned by flake.lock. `task nix:update-ohm-cli`
            # bumps it. A checkout from OHM_GO_DEV has no rev; the
            # shellHook builds that one, through mkOhmCliLocal.
            (mkOhmCli pkgs);

          shellHook = ''
            # Where the browsers above live, and an instruction not to go
            # looking for any others: without these, playwright hunts in
            # ~/Library/Caches/ms-playwright and downloads its own.
            export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            ${nixpkgs.lib.optionalString pkgs.stdenv.hostPlatform.isLinux ''
              # Linux only: playwright's host check reads ldd and fails on a
              # nix store browser. It prints a line on every run, so it is
              # not set where it is not needed.
              export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
            ''}

            ${mkBuildHook pkgs}
            ${nixpkgs.lib.optionalString (!(ohm-go ? rev)) mkOhmCliLocal}

            echo "protowx"
            echo "  ------------------------------------------"
            echo "  task       list every task in Taskfile.yml"
            echo "  ------------------------------------------"
            echo "  playwright    ${pkgs.playwright-driver.version}"
            echo "  ------------------------------------------"
            echo "  repo-tools    ${toolsSource}"
            echo "  ------------------------------------------"
            echo "  ohm-cli       ${ohmSource}"
            echo "  ------------------------------------------"
            echo -n "  go.work     "
            case "''${GOWORK:-}" in
              "") echo "  this checkout's, ./go.work" ;;
              off) echo "  none, GOWORK=off" ;;
              *) echo "  WORKSPACE, $GOWORK" ;;
            esac
            echo "  ------------------------------------------"
            echo
          '';
        };
      });

      # ohm-cli alone, so `task nix:update-ohm-cli` can build it and read
      # a new vendorHash without entering the shell.
      packages = forAllSystems (pkgs: {
        ohm-cli = mkOhmCli pkgs;
      });

      formatter = forAllSystems (pkgs: pkgs.nixpkgs-fmt);
    };
}
