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
