# Change log

What is new in protowx, in a line or two a day. The detail is in two
logs: [user_manual/changelog.md](user_manual/changelog.md) for the
user, and [admin_manual/changelog.md](admin_manual/changelog.md)
for the admin who runs the stack.

## 2026-11-12

- The README tells a new person how to set up a Mac, step by step, with the fix for each problem that the first Mac hit.

## 2026-10-29

- The stack warns a week before your Tailscale auth key expires, and
  refuses to start on an expired key.
- `task fastdev` starts the stack in one command. It checks your
  tailnet credentials first, and names the fix when one is missing.
- A second stack, on ngrok: the same page on a public HTTPS URL, for
  someone who is not on your tailnet. A Google login guards it when
  you name the addresses that may come in.

## 2026-10-28

- `v0.1.0`, the first tag: the calculator, the page, the dictation and
  the stack. The traces follow.
- The compose stack: the page and the dictation on HTTPS, behind one
  tailnet node.
- Dictate an expression: My Whisper turns speech into the text.
- The page: keep calculations in a list, edit them in a form, and
  evaluate them, offline in the browser or connected to `bff`.
- A feedback recording turns what you did into one file an agent reads
  as a prompt.
