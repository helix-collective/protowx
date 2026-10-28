# report-state: the report records the model and the UI

**Status.** Not started; this stub is the line of the todo. The
feedback report of [001-calculator/prd.md](../001-calculator/prd.md)
section 6 records the messages. This feature also records each change
to the model's state, as a diff of `Store`. It records the UI's state
as a value of an ADL type of its own, `spec/ui.adl`: the open
calculation, the form's draft, the selection, the folds. A reader of
the report sees the model and the page at each step, without the
messages.
