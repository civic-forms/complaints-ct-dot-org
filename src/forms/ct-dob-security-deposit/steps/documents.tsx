// Documents (CLAUDE.md §7, §8.4): an intro listing the derived slots, then one
// page per slot.

import en from '../../../i18n/en.json' with { type: 'json' };
import { t } from '../../../i18n/t.ts';
import { deriveSlots, type SlotId } from '../checklist.ts';
import { slotFileCounts } from '../uploads.ts';
import { SlotUpload } from './slot-upload.tsx';
import type { StepProps } from './types.ts';

export function DocumentsIntro({ state, uploads }: StepProps) {
  const counts = slotFileCounts(state, uploads);
  return (
    <>
      <p class="lead">{en.chapters.documents.intro}</p>
      <ol class="checklist">
        {deriveSlots(state).map((slot) => (
          <li key={slot.id}>
            <span class={slot.appDefined ? undefined : 'verbatim'}>{slot.label}</span>
            {counts[slot.id] ? (
              <span class="field-help">
                {' '}
                ({t(en.upload.added, { count: counts[slot.id] ?? 0 })})
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </>
  );
}

export function slotPage(slotId: SlotId) {
  return function SlotPage(props: StepProps) {
    return <SlotUpload slotId={slotId} {...props} />;
  };
}
