// Step 8: one upload slot per derived checklist item (CLAUDE.md §8.4). Uploads
// arrive in Phase 4; for now this lists the slots.

import en from '../../../i18n/en.json' with { type: 'json' };
import { deriveSlots } from '../checklist.ts';
import type { StepProps } from './types.ts';

export function Documents({ state }: StepProps) {
  return (
    <>
      <p>{en.steps.documents.placeholder}</p>
      <ol class="checklist">
        {deriveSlots(state).map((slot) => (
          <li key={slot.id}>
            <span class={slot.appDefined ? undefined : 'verbatim'}>{slot.label}</span>
            {slot.hint && <span class="field-help"> ({slot.hint})</span>}
            {slot.help && <p class="field-help">{slot.help}</p>}
            {slot.note && <p class="field-help">{slot.note}</p>}
          </li>
        ))}
      </ol>
    </>
  );
}
