# adl-render: the form drawn from the ADL type

**Status.** Not started; this stub is the line of the todo. A
dynamic ADL render, from
[adl-lang/adl-ui](https://github.com/adl-lang/adl-ui). The form of
[001-calculator/prd.md](../001-calculator/prd.md) section 4.2 is
written by hand over `model.Calculation`. This feature draws the form
from the type at run time, through the declarations that the adlc
TypeScript runtime ships. A new field in `model.adl` is then a new
field on the page, with no component written. The hand-written form
stays as the test of the drawn one until both agree, then goes.

## Decisions at a glance

Each concern is a heading; the ticked line is the decision, and each
unticked line is a runner-up. To change a decision, move the tick and
say why in the section the concern cites.

### how the form is made

- [x] **drawn from the ADL type at run time, through the
      declarations of the adlc TypeScript runtime**
- [ ] hand-written Solid components over `model.Calculation`, as in
      [001-calculator/prd.md](../001-calculator/prd.md) section 4.2

### the hand-written form

- [x] **stays as the test of the drawn form until both agree, then
      goes**
- [ ] goes when the drawn form lands

### regression scenarios

- [x] **`adl-render`**, the feature's own: not written yet; `task
      feature:scenario -- adl-render` writes it as a `todo`.
- [ ] none

### visual diff

- [ ] yes: the scenarios take shots, and the plan takes their
      baselines.
- [x] **no.** The scenarios check with `see` steps alone.
