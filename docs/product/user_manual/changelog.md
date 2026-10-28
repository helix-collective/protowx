# Change log

What changed in how you work on the page, newest first: a new gesture,
key, menu item or message, or one that now behaves differently. One
section per day; each entry gives its kind (added, changed, fixed or
removed), what you do now, the page that explains it, and the commit.
The brief product log is [../changelog.md](../changelog.md).

## 2026-10-28

- **Added.** **dictate**, to the right of the text, when `bff` names
  My Whisper. Click **dictate** and speak; click **● stop**, and the
  words go after the text. The page does not draw the button offline,
  or when no service is set. See
  [the glossary](../../glossary.md#the-form).
- **Added.** The page: the bar, the calculation list, the form and the
  result. Click a row to open a calculation, click **evaluate** to see
  its value and its printed expression, and click **new**, **save**
  and **delete** to keep your calculations. A parse error shows under
  the text, at its column; an evaluation error shows in the result.
  See [guides/evaluating-an-expression.md](guides/evaluating-an-expression.md).
- **Added.** **record** in the bar starts a feedback recording; a
  second click opens the feedback dialog, which sends one Markdown
  file to `.bugreports/`. `Alt+Shift+S` takes a screenshot while a
  recording runs. See [the glossary](../../glossary.md#the-feedback-dialog).
