// Documents (CLAUDE.md §7, §8.4): an intro listing the derived slots, then one
// page per slot. Uploads arrive in Phase 4.

import en from '../../../i18n/en.json' with { type: 'json' };
import { deriveSlots, type SlotId } from '../checklist.ts';
import { SlotUpload } from './shared.tsx';
import type { StepProps } from './types.ts';

export function DocumentsIntro({ state }: StepProps) {
  return (
    <>
      <p class="lead">{en.chapters.documents.intro}</p>
      <ol class="checklist">
        {deriveSlots(state).map((slot) => (
          <li key={slot.id}>
            <span class={slot.appDefined ? undefined : 'verbatim'}>{slot.label}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

export function slotPage(slotId: SlotId) {
  return function SlotPage({ state }: StepProps) {
    return <SlotUpload slotId={slotId} state={state} />;
  };
}
