# report-state: the report records the model and the UI

**Status.** Not started; this stub is the line of the todo. The
feedback report of [001-calculator/prd.md](../001-calculator/prd.md)
section 6 records the messages. This feature also records each change
to the model's state, as a diff of `Store`. It records the UI's state
as a value of an ADL type of its own, `spec/ui.adl`: the open
calculation, the form's draft, the selection, the folds. A reader of
the report sees the model and the page at each step, without the
messages.

## Decisions at a glance

Each concern is a heading; the ticked line is the decision, and each
unticked line is a runner-up. To change a decision, move the tick and
say why in the section the concern cites.

### what the report records

- [x] **the messages, each change to `Store` as a diff, and the UI's
      state as a value of `spec/ui.adl`**
- [ ] the messages alone, as in
      [001-calculator/prd.md](../001-calculator/prd.md) section 6

### the UI state's type

- [x] **an ADL type of its own, `spec/ui.adl`**: the open
      calculation, the form's draft, the selection, the folds
- [ ] the page's own TypeScript state, serialised as it is

### regression scenarios

- [x] **`report-state`**, the feature's own: not written yet; `task
      feature:scenario -- report-state` writes it as a `todo`.
- [ ] none

### visual diff

- [ ] yes: the scenarios take shots, and the plan takes their
      baselines.
- [x] **no.** The scenarios check with `see` steps alone.
