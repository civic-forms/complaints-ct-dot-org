import type { ChoiceOption } from '../../../core/ui/fields.tsx';
import verbatim from '../verbatim.json' with { type: 'json' };

const opt = verbatim.optionLabels;

export const YES_NO: readonly ChoiceOption<'yes' | 'no'>[] = [
  { value: 'yes', label: opt.yes },
  { value: 'no', label: opt.no },
];

export const YES_NO_NOT_SURE: readonly ChoiceOption<'yes' | 'no' | 'not_sure'>[] = [
  ...YES_NO,
  { value: 'not_sure', label: opt.notSure },
];
