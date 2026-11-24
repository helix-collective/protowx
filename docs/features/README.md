# Features

One directory per feature, oldest first. The number gives the order of
the first commits: of the PRD, or of the plan where there is no PRD. A
new feature takes the next number. The rules for each file are in
[AGENTS.md](AGENTS.md).

An `x` marks a file that exists. `prd` names each argument in the
directory; `shots` is `screenshots/`.

| feature                  | prd | plan | arch | shots | mockups |
|--------------------------|-----|------|------|-------|---------|
| `001-calculator`         | prd | x    |      |       |         |
| `002-storage`            | prd |      |      |       |         |
| `003-adl-render`         | prd |      |      |       |         |
| `004-report-state`       | prd |      |      |       |         |
| `005-concurrent-editing` | prd |      |      |       |         |
| `006-replay`             | prd |      |      |       |         |
| `007-repo-setup`         | prd | x    |      |       |         |
| `008-fidel`              | prd |      |      |       |         |

A new feature gets its row in the commit that creates its directory.

## Plans

The tasks of each `plan.md`, open and done. The block below is written
by `repo-tools plan-report`, through `md-tmpl`. The `echo` puts the
table on its own lines, so GitHub renders it. A prek hook rewrites it
when a commit holds a `plan.md`; do not edit it by hand. By hand:

```sh
md-tmpl -w docs/features/README.md
```

<!--tmpl:echo; repo-tools plan-report -d . -f '^plan.*\.md$' -->
| feature                                    | open | in progress | done | total | % complete |
|--------------------------------------------|------|-------------|------|-------|------------|
| [001-calculator](./001-calculator/plan.md) | 6    | 3           | 102  | 111   | 92%        |
| [007-repo-setup](./007-repo-setup/plan.md) | 0    | 3           | 21   | 24    | 88%        |
<!--/tmpl-->
