# Change log

What changed in how you run protowx, newest first: a new or different
command, flag, subcommand, task, route, file or directory, and any
step an upgrade needs. One section per day; each entry gives its kind
(added, changed, fixed or removed), what you type or do now, and the
commit. The brief product log is [../changelog.md](../changelog.md).

## 2026-10-28

- **Added.** `services/myw`, My Whisper, the transcription service of
  **dictate**. `task myw:model` downloads the model once, 142 MB.
  `task myw:serve` serves on `127.0.0.1:8090`; then `task
  bff:connected -- --myw-url http://127.0.0.1:8090` names it to the
  page. A `bff` on another address needs `myw serve --origin <its
  origin>`. See [services/myw/README.md](../../../services/myw/README.md).
- **Changed.** `task test`, and so `task gate`, runs `task myw:test`,
  which downloads the model on its first run.
