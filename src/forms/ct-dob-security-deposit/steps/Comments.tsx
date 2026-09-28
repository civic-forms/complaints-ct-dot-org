// Step 9: Additional Comments. Only what the user types; a neutral prompt, no
// examples or sentence starters (CLAUDE.md §2.2).

import { TextArea } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import { t } from '../../../i18n/t.ts';
import verbatim from '../verbatim.json' with { type: 'json' };
import { kit, onTheForm } from './kit.ts';
import type { StepProps } from './types.ts';

const c = en.steps.comments;

export function Comments(props: StepProps) {
  const k = kit(props);
  const value = props.state.additionalComments;
  return (
    <TextArea
      id="additionalComments"
      label={en.fields.questions.additionalComments}
      hint={onTheForm(verbatim.page1Labels.additionalComments)}
      help={c.overflowNote}
      value={value}
      onInput={(additionalComments) => props.update((s) => ({ ...s, additionalComments }))}
      rows={10}
      footer={t(c.count, { count: Array.from(value).length.toLocaleString('en-US') })}
      unprintable={k.chars('additionalComments')}
    />
  );
}
