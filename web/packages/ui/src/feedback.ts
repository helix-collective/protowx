// The feedback dialog's words: the types and the kinds, as its two
// selects name them. The app's bugReport.ts reads the same values to
// write the file: the type sets the file's first paragraph and the
// copy as prompt line, and the kind sets which sections it holds.

/**
 * What the feedback is, chosen in the dialog: what the user says the
 * file is about. It is independent of the kind, which says what the
 * file holds.
 */
export type FeedbackType = 'bug' | 'feature request' | 'improvement' | 'wording' | 'question' | 'other';

export const FEEDBACK_TYPES: readonly FeedbackType[] = ['bug', 'feature request', 'improvement', 'wording', 'question', 'other'];

/** Each type as the dialog's select names it: the type, then what it is. */
export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'bug: a thing that is wrong',
  'feature request': 'feature request: a thing the page does not do',
  improvement: 'improvement: a thing that could work better',
  wording: 'wording: a word or a message that is wrong or unclear',
  question: 'question: how to do a thing',
  other: 'other: none of these',
};

/**
 * The types whose kind is `prompt` until the user picks a kind: what
 * they hold is the user's words and screenshots, not a fault's evidence.
 */
export const PROMPT_TYPES: ReadonlySet<FeedbackType> = new Set(['feature request', 'wording', 'question']);

/** What the file holds, chosen in the dialog. */
export type BugKind = 'general' | 'ui' | 'engine' | 'prompt';

export const BUG_KINDS: readonly BugKind[] = ['general', 'ui', 'engine', 'prompt'];

/** Each kind as the dialog's select names it: the kind, then what the file holds. */
export const BUG_KIND_LABELS: Record<BugKind, string> = {
  general: 'general: everything',
  ui: 'ui: the page, no store and no messages',
  engine: 'engine: the store and the messages',
  prompt: 'prompt: a request, the words and screenshots alone',
};
