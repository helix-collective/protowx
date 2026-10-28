# Evaluating an expression

This page is a guide. It shows how to write a calculation, evaluate
it, and keep it. The names of the parts on screen are in the
[glossary](/docs/glossary.md).

![The page with the calculation "the example" open. The calculation list on the left marks "the example" as the open row. The form in the middle shows the text (x + 3) * y and the bindings x = 5 and y = 1. The result on the right shows the value 8 and, under it, the printed expression ((x + 3) * y).](../screenshots/evaluating-an-expression-1.png)

## Evaluate a calculation

1. Click a row in the **calculation list**. The **form** shows the
   calculation, and the row is the **open row**.
2. Click **evaluate**, or press `Enter` in a field of the form.
3. Read the **result**. The **value** is large, in the calculation's
   **base**. Under it, the **printed expression** puts each operation
   in brackets, so you see the order: `2 + 3 * 4` prints as
   `(2 + (3 * 4))`, and its value is `14`.

The four operators are `+`, `-`, `*` and `/`. Times and divide bind
tighter than plus and minus. Brackets change the order. A value is a
whole number, and `/` drops the remainder: `7 / 2` is `3`.

## Write a new calculation

1. Click **new**. The form is empty.
2. Type a **name**, such as `rent`.
3. Type the **text**, such as `a * 12`.
4. Click **add** under the **bindings**, and give the binding a name,
   `a`, and a whole number, `900`. Each variable in the text needs a
   binding. The `×` at a binding's right end removes it.
5. Pick a **base**: `decimal`, `hex` or `binary`. The value `14` is
   `0xe` in hex and `0b1110` in binary.
6. Click **save**. The calculation is a new row at the end of the
   list, and it is the open row.

The checkbox **notes** shows a text area for your own notes. The
checkbox **star** puts a `★` before the row's name.

## Change or delete a calculation

1. Click its row.
2. Change a field, then click **save**. The row keeps its place.
3. Or click **delete**. The row goes from the list, and the form is
   empty. **delete** is not available for a calculation that you have
   not saved.

## When the text does not evaluate

A **parse error** is a text that is not an expression. The message is
under the text, and its `^` is under the column where the text stops
making sense: `^ Line 1, col 8: match failed` for `10 / (2`. Fix the
text, and click **evaluate** again.

An **evaluation error** replaces the value in the result:

| message                    | what to do                                       |
|----------------------------|--------------------------------------------------|
| `unknown variable x`       | add a binding named `x`                          |
| `division by zero: 10 / 0` | change the divisor; the message prints the parts |
| `the value overflows`      | use smaller numbers                              |

## Where your calculations are kept

The bar says the **mode**.

- **offline**: the page keeps your changes until you reload it. The
  status line says `offline: changes are kept until reload` when the
  page starts.
- **connected**: the server keeps your changes in a file. A reload
  shows them again.

## See also

- [glossary.md](/docs/glossary.md): the names of the parts.
- [changelog.md](../changelog.md): what changed on the page.
