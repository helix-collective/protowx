# Glossary

The names for what is on screen, so a sentence like "the result shows
the error" means one thing to everybody. The terms here are the ones
used in the code, the comments, the PRD and the tests; when you add a
part, name it here first.

See [features/001-calculator/prd.md](features/001-calculator/prd.md)
section 4 for what the page is for.

Every part named here is painted from a custom property named for it,
and they are all in one file, `web/packages/ui/src/theme.css`, whose
groups follow this page's. Sizes, fills, faces, rules and their
thicknesses are changed there and nowhere else. When you add a part,
name it here and give it its tokens there.

## The picture

The page is one screen: a bar on top, and three parts side by side
under it.

```
 ┌──────────────────────────────────────────────────────────────┐
 │ bar: record · mode · status line                             │
 ├──────────────────┬───────────────────────────┬───────────────┤
 │ calculation list │ form                      │ result        │
 │ [new]            │ name                      │               │
 │ ★ precedence     │ text            [dictate] │      3        │
 │   example        │ bindings: x 5, y 1, [add] │               │
 │   divide by 0    │ base · notes · star       │ printed       │
 │                  │ [evaluate] [save] [delete]│               │
 └──────────────────┴───────────────────────────┴───────────────┘
```

## The bar

**bar** — the strip at the top of the page. It holds the **record**
button, the mode and the status line.

**record** — the button that starts a feedback recording. A second
click ends the recording and opens the feedback dialog.

**mode** — which engine the page talks to: **offline**, the engine in
a Web Worker, or **connected**, the engine behind `bff`.

**status line** — one sentence that says what the page did last. In
the offline mode it says once: `offline: changes are kept until
reload`.

## The calculation list

**calculation list** — the column on the left. One row per
calculation.

**row** — one calculation in the list: its star and its name. A click
on a row opens it in the form.

**open row** — the row whose calculation is in the form. It is marked
in colour, not in size.

**new** — the button above the rows. It opens an empty calculation in
the form.

## The form

**form** — the part in the middle: the fields of one calculation. The
form is the calculator.

**name** — the field for the calculation's name.

**text** — the input for the expression, in the syntax of
`spec/calc.ohm`.

**parse error** — the message under the text when the text does not
parse, at its column.

**dictate** — the button beside the text. It records speech until it
is clicked again, and puts the transcript in the text. The page draws
it only when a transcription service is set.

**bindings** — the small table of the variables the expression may
name: a name and a value per row.

**add** — the row below the bindings that adds a binding.

**base** — the select for how the result is shown: decimal, hex or
binary.

**notes** — the text area for free notes. A checkbox shows and hides
it.

**star** — the checkbox that marks a calculation. The list shows the
star beside the name.

**evaluate** — the button beside **save**. It evaluates the text with
the bindings and shows the result.

**save** — the button that writes the calculation to the store.

**delete** — the button that removes the calculation from the store.

## The result

**result** — the part on the right. It shows the value and the
printed expression.

**value** — the integer the expression evaluates to, large, in the
calculation's base. An evaluation error replaces it with its message.

**printed expression** — the expression fully parenthesised, under
the value, so the precedence is visible: `(x + 3) * y - 10 / 2` is
`(((x + 3) * y) - (10 / 2))`.
