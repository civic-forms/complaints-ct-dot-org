import type { ChoiceOption } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import verbatim from '../verbatim.json' with { type: 'json' };

const opt = verbatim.optionLabels;
const app = en.common.answers;

/** The form's printed options (page 1 YES/NO questions). */
export const FORM_YES_NO: readonly ChoiceOption<'yes' | 'no'>[] = [
  { value: 'yes', label: opt.yes },
  { value: 'no', label: opt.no },
];

/** Cash for Keys: the only form question with NOT SURE. */
export const FORM_YES_NO_NOT_SURE: readonly ChoiceOption<'yes' | 'no' | 'not_sure'>[] = [
  ...FORM_YES_NO,
  { value: 'not_sure', label: opt.notSure },
];

/** The app's own questions (gates, confirmations, forwarding address). */
export const APP_YES_NO: readonly ChoiceOption<'yes' | 'no'>[] = [
  { value: 'yes', label: app.yes },
  { value: 'no', label: app.no },
];

export const APP_YES_NO_NOT_SURE: readonly ChoiceOption<'yes' | 'no' | 'not_sure'>[] = [
  ...APP_YES_NO,
  { value: 'not_sure', label: app.notSure },
];
