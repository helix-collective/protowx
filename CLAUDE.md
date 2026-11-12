@AGENTS.md

@docs/kb/go-style.md

## Claude Code specifics

The shared instructions are in `AGENTS.md`, imported above. Put anything
agent-agnostic there; keep this file for Claude-only notes. Each module's
`CLAUDE.md` is the same one-line import of the `AGENTS.md` beside it.

- Invoke the `go-cli` skill before writing an opts-based `main` or adding
  a subcommand.
- Invoke the `merge-features` skill before a merge, a refresh, or a
  finish.
- Invoke the `regression-scenario` skill when a phase changes what the
  page shows, or when a gate prints `todo:`.
- Invoke the `repo-setup` skill when a prompt asks to set up the repository, a new Mac or a new clone.
- `.claude/settings.json` registers a `Stop` hook,
  `prompt-history-record`, that writes one entry per turn (and one per
  subagent) to `.prompts/history/<branch>/` in the repository the turn
  edited. Leave both in place. The transcripts are generated; do not
  read or edit them. `.prompts/history/meta-info.csv` is derived from
  them: `prompt-history-meta` rebuilds it, and the record command's
  `-all`, with the hook's JSON on stdin (`transcript_path`, `cwd`,
  `session_id`), records a missed session. Both commands come from
  [wxio/repo-tools](https://github.com/wxio/repo-tools), through
  the flake, so they are on `PATH` in the dev shell.
