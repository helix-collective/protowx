# phase-4-first-baselines

The baselines that `task baselines -- phase-4-first-baselines` took again, on
`main`, 2026-10-28 18:30. [index.html](index.html) is the visual diff:
open it in a browser.

The commits:

- `HEAD`: `0e54af545f836c41844692fcbc65efca08548489`, calc: phase 3, the server

The old baseline of a shot is the one in git's index. The `old commit`
column names the commit that wrote it. The new baseline is the one in
the worktree. The commit that adds this directory holds it. The region
is the box around every changed pixel, as width×height at x,y.

| scenario   | shot                    | pixels | region | old commit |
|------------|-------------------------|--------|--------|------------|
| `crud`     | `connected/end`         | new    |        |            |
| `crud`     | `connected/renamed`     | new    |        |            |
| `crud`     | `connected/saved`       | new    |        |            |
| `crud`     | `offline/end`           | new    |        |            |
| `crud`     | `offline/renamed`       | new    |        |            |
| `crud`     | `offline/saved`         | new    |        |            |
| `evaluate` | `connected/division`    | new    |        |            |
| `evaluate` | `connected/end`         | new    |        |            |
| `evaluate` | `connected/parse-error` | new    |        |            |
| `evaluate` | `connected/value`       | new    |        |            |
| `evaluate` | `offline/division`      | new    |        |            |
| `evaluate` | `offline/end`           | new    |        |            |
| `evaluate` | `offline/parse-error`   | new    |        |            |
| `evaluate` | `offline/value`         | new    |        |            |
| `report`   | `connected/dialog`      | new    |        |            |
| `report`   | `connected/end`         | new    |        |            |
| `report`   | `connected/recording`   | new    |        |            |

## The verdicts


- crud/saved: new — the calculation list after save: "rent" is the
  fourth row, the open row.
- crud/renamed: new — the form after the rename and the second save:
  "rent a year", `a * 12`, one binding `a = 900`.
- crud/end: new — the whole page after delete: three rows, an empty
  form, and the status line `deleted "rent a year"`.
- evaluate/value: new — the result of "the example": `8` and
  `((x + 3) * y)`.
- evaluate/division: new — the evaluation error `division by zero: 10 / 0`
  in the value's place.
- evaluate/parse-error: new — the form with `10 / (2` and the parse
  error `^ Line 1, col 8: match failed` under the text.
- evaluate/end: new — the whole page with the parse error, and the
  status line `the text does not parse`.
- report/recording: new — the bar: `stop · 1 change`, the mode and
  `saved "rent"`.
- report/dialog: new — the feedback dialog before submit: the type,
  the kind, the title, the message, no screenshot.
- report/end: new — the whole page after close: the row "rent", and
  the status line `feedback saved`.

Each verdict holds for the offline and the connected shot alike; the
two differ in the mode's word only.
