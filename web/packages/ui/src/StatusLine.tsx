// The status line: the words in the bar after the mode, what the page
// did last. docs/glossary.md, "status line".
//
// Controls stay put (web/AGENTS.md): it is one line of a fixed width,
// `--pw-status-width`, so a sentence of any length moves no control
// beside it, and never wraps to make the bar taller. A sentence that
// does not fit is cut with an ellipsis, and the title holds it whole.

import type { JSX } from 'solid-js';

export interface StatusLineProps {
  text: string;
}

export function StatusLine(props: StatusLineProps): JSX.Element {
  return (
    <span class="status-line" data-term="status-line" role="status" title={props.text}>
      {props.text}
    </span>
  );
}
