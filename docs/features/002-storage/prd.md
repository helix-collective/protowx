# storage: the server's persistent storage

**Status.** Not started; this stub is the line of the todo. The
storage model is built in the source first, then copied here. It
replaces the JSON file of
[001-calculator/prd.md](../001-calculator/prd.md) section 2.3 with
the server's persistent storage. The starter takes it as its
`Storage`, behind the same interface. The memory store of the offline
page stays.

## Decisions at a glance

Each concern is a heading; the ticked line is the decision, and each
unticked line is a runner-up. To change a decision, move the tick and
say why in the section the concern cites.

### where the connected records are kept

- [x] **the server's persistent storage, behind `Storage`**
- [ ] the JSON file under `--store` of
      [001-calculator/prd.md](../001-calculator/prd.md) section 2.3

### where the offline records are kept

- [x] **in memory, as today**
- [ ] the server's persistent storage

### regression scenarios

- [x] **`storage`**, the feature's own: not written yet; `task
      feature:scenario -- storage` writes it as a `todo`.
- [ ] none

### visual diff

- [ ] yes: the scenarios take shots, and the plan takes their
      baselines.
- [x] **no.** The scenarios check with `see` steps alone.
