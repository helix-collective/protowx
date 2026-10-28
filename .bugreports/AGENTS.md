# .bugreports

The repo-wide rules are in the root `AGENTS.md`. This file covers
`.bugreports/`: the feedback reports the page writes, through `bff`
with `--bugs`, or as a download.

**Reader.** An agent given one report as its prompt. The report is the
evidence. Its heading's **type** row says what the user asks: for a
`bug`, fix the bug it shows, and write the failing test first.
`docs/features/001-calculator/prd.md` section 6 is the design.

**A report is** one Markdown file, `YYYYMMDD-HHMM__<title>.md`, with
its screenshots, `<name>.png`, its narration, `<name>.wav`, and its
recording file, `<name>.recording.json`, beside it. The directory is
local: git ignores it. A recording kept as a test is added with
`git add -f`.

## The type

The user reads the word **feedback**, and a report is feedback of
one type. The directory, the `--bugs` flag and the `/api/bugreport`
routes keep the word "bug". The type is in the heading table, not in
the file name.

| type              | do                                               |
|-------------------|--------------------------------------------------|
| `bug`             | fix the bug; write the failing test first        |
| `feature request` | write a PRD for the feature, in `docs/features/` |
| `improvement`     | improve the thing it names                       |
| `wording`         | fix the word, the label or the message it names  |
| `question`        | answer the question; change nothing unless asked |
| `other`           | read the feedback, and ask what to do            |

A report written before the type has no type row: read it as a `bug`.

## Read a report in this order

1. **What the user says**: the complaint.
2. **Steps**: what the user did, by time, from the record button on.
3. **Engine messages**: the store at the start, then each request and
   each response, to feed a fresh engine.
4. **Page state** and its **UI state**: where the focus and the
   selection were at the start and at the end.

## The Steps lines

| what     | the line, after its time                                     |
|----------|--------------------------------------------------------------|
| `status` | a sentence of the status line                                |
| `key`    | `Enter · form · on text → evaluated`                         |
| `click`  | `calculation list · row precedence → open in the form`       |
| `focus`  | `from calculation list to form`: a move no key or click made |

A key line names the key as the user pressed it, with the platform's
names: `Control`, `Cmd`, `Option` and `Shift` on a Mac; `Ctrl`, `Meta`,
`Alt` and `Shift` elsewhere.

After the key, the line names the part with the focus, what the key
was on, and what changed after it. A key that changed nothing says
`no change` or `no binding`; that is often the bug. A key in a field
is not a line unless the page binds it, or it is `Enter`, `Escape` or
`Tab`. `a character` is a key that typed one; the value is never in a
step.

## The zero

The record button is the start of the report. The store at the start,
the page state and the UI state are the state at that moment. Engine
messages leaves out a message begun before it, and says so. To see a
change from before the start, ask the user to record again from an
earlier point.

## Who writes here

The page writes the reports. Anyone writes this file.
