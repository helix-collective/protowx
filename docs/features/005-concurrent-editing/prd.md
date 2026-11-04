# concurrent-editing: two pages edit one store

**Status.** Not started; this stub is the line of the todo. Two
pages edit one store. The protocol of
[001-calculator/prd.md](../001-calculator/prd.md) section 2.2 gains a
version per record and a refusal of a stale `put`. Then the server
sends a stream of changes to each page, so a save on one page appears
on the other. The single-tenant engine of section 3 ends here: this
feature is what sessions and a grammar pool are for.

## Decisions at a glance

Each concern is a heading; the ticked line is the decision, and each
unticked line is a runner-up. To change a decision, move the tick and
say why in the section the concern cites.

### how two pages agree on a record

- [x] **a version per record, and a refusal of a stale `put`**
- [ ] one page per store, as in
      [001-calculator/prd.md](../001-calculator/prd.md) section 3

### how a page sees another page's save

- [x] **the server sends a stream of changes to each page**
- [ ] the page reads the list again on each action

### regression scenarios

- [x] **`concurrent-editing`**, the feature's own: not written yet;
      `task feature:scenario -- concurrent-editing` writes it as a
      `todo`.
- [ ] none

### visual diff

- [ ] yes: the scenarios take shots, and the plan takes their
      baselines.
- [x] **no.** The scenarios check with `see` steps alone.
