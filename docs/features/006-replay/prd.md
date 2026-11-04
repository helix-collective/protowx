# replay: the model and the UI traces played back

**Status.** Not started; this stub is the line of the todo. A
replay over the recording of
[004-report-state](../004-report-state/prd.md): the steps of a report
played back on the page. At each step the model is restored, and the
UI state is put back as the ADL value says, with the trace of
[001-calculator/prd.md](../001-calculator/prd.md) section 7 beside
it. The replay bar and the step editor are copied from the source.
The starter's replay restores a `Store` and a `ui.adl` value.

## Decisions at a glance

Each concern is a heading; the ticked line is the decision, and each
unticked line is a runner-up. To change a decision, move the tick and
say why in the section the concern cites.

### what a step restores

- [x] **the model, a `Store`, and the UI, a `ui.adl` value, with the
      trace of [001-calculator/prd.md](../001-calculator/prd.md)
      section 7 beside it**
- [ ] the model alone

### where the replay bar and the step editor come from

- [x] **copied from the source**
- [ ] written here

### regression scenarios

- [x] **`replay`**, the feature's own: not written yet; `task
      feature:scenario -- replay` writes it as a `todo`.
- [ ] none

### visual diff

- [ ] yes: the scenarios take shots, and the plan takes their
      baselines.
- [x] **no.** The scenarios check with `see` steps alone.
