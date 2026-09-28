// Step 2: the evidence checklist derived from the selected types (CLAUDE.md
// §8.4), with the forwarding-address note verbatim for box 1. Never blocks.

import { Notice } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import { deriveSlots } from '../checklist.ts';
import verbatim from '../verbatim.json' with { type: 'json' };
import type { StepProps } from './types.ts';

const n = en.steps.needs;

export function Needs({ state }: StepProps) {
  const anyType = Object.values(state.complaintTypes).some(Boolean);
  const slots = deriveSlots(state);
  return (
    <>
      {state.complaintTypes.formerTenantDepositNotReturned && (
        <Notice kind="warning">
          <span class="verbatim">{verbatim.forwardingAddressNote}</span>
        </Notice>
      )}
      <p>{anyType ? n.intro : n.noTypes}</p>
      <ul class="checklist">
        {slots.map((slot) => (
          <li key={slot.id}>
            <span class={slot.appDefined ? undefined : 'verbatim'}>{slot.label}</span>
            {slot.hint && <span class="field-help"> ({slot.hint})</span>}
          </li>
        ))}
      </ul>
    </>
  );
}
