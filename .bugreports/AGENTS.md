# .bugreports

The repo-wide rules are in the root `AGENTS.md`. This file covers
`.bugreports/`: the feedback reports the page writes, through `bff`
with `--bugs`, or as a download.

**Reader.** An agent given one report as its prompt. The report is the
evidence. Its heading's **type** row says what the user asks: for a
`bug`, fix the bug it shows, and write the failing test first.
`docs/features/001-calculator/prd.md` section 6 is the design.

**A report is** one Markdown file, `YYYYMMDD-HHMM__<title>.md`, with
its screenshots, `<name>.png`, beside it. The directory is local: git
ignores it. A report kept as a test is added with `git add -f`.

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
2. **Steps**: what the page did, by time, from the record button on.
3. **The store at the start** and **Replay**: the file of `bff
   --store`, and each request that changed it. Start a fresh `bff` on
   the file, and send the requests to `POST /api/calc`, in order.
4. **What the engine answered**, **The store at the end** and **The
   form**: what the replay must give back.
5. **Errors** and **Engine messages**: each failed message, each error
   the page threw, and every message by its number.

The **kind** row says which sections the file holds. A `ui` report has
no store and no message; a `prompt` report has the user's words alone.

## The Steps lines

| what     | the line, after its time                          |
|----------|---------------------------------------------------|
| `status` | a sentence of the status line                     |
| `put`    | a save: `a new calculation, "rent"`, or `id 4, …` |
| `delete` | a delete: `id 4`                                  |

The recording holds the messages and the status line. It holds no key
and no click: a report shows the page's state through its screenshots
and the form at both ends.

## The zero

The record button is the start of the report. The store at the start
and the form are the state at that moment. Engine messages leaves out
a message begun before it, and says so. To see a
change from before the start, ask the user to record again from an
earlier point.

## Who writes here

The page writes the reports. Anyone writes this file.
