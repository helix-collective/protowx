// The Solid components of the page, and theme.css with the shapes in
// ui.css. Importing any component brings both stylesheets.

import './theme.css';
import './ui.css';

export { Bar, stopWords, type BarProps } from './Bar';
export { StatusLine, type StatusLineProps } from './StatusLine';
export { CalculationList, NO_NAME, type CalculationListProps } from './CalculationList';
export { CalculationForm, BASES, type CalculationFormProps, type ParseErrorView } from './CalculationForm';
export { Bindings, integerOf, type BindingsProps } from './Bindings';
export { Result, NO_RESULT, type ResultProps } from './Result';
export { BugReportDialog, type BugReportDialogProps, type SavedView } from './BugReportDialog';
export {
  BUG_KIND_LABELS,
  BUG_KINDS,
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_TYPES,
  PROMPT_TYPES,
  type BugKind,
  type FeedbackType,
} from './feedback';
