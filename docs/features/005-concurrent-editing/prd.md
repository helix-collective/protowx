# concurrent-editing: two pages edit one store

**Status.** Not started; this stub is the line of the todo. Two
pages edit one store. The protocol of
[001-calculator/prd.md](../001-calculator/prd.md) section 2.2 gains a
version per record and a refusal of a stale `put`. Then the server
sends a stream of changes to each page, so a save on one page appears
on the other. The single-tenant engine of section 3 ends here: this
feature is what sessions and a grammar pool are for.
