// Small helpers the steps share for wiring fields to state and messages.

import type { Unprintable } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import { t } from '../../../i18n/t.ts';
import type { TextPath } from '../fieldMap.ts';
import type { DepositComplaintState } from '../schema.ts';
import { inlineMessages, unprintableMessage } from '../validation.ts';
import type { StepProps } from './types.ts';

/** "On the form: Move In Date" */
export const onTheForm = (label: string) => t(en.common.onTheForm, { label });

export function kit({ unsupported, warnings, update }: StepProps) {
  return {
    /** The unprintable-character message for a field (null when none). */
    chars(path: TextPath): Unprintable | null {
      const entry = unsupported.find((u) => u.path === path);
      return entry ? { key: entry.chars.join(''), message: unprintableMessage(entry.chars) } : null;
    },
    inline: (id: string) => inlineMessages(warnings, id),
    /** Shallow-merge into one top-level section of state. */
    patch<K extends 'tenant' | 'landlord' | 'rental' | 'complaintTypes' | 'signature'>(
      key: K,
      partial: Partial<DepositComplaintState[K]>,
    ) {
      update((s) => ({ ...s, [key]: { ...s[key], ...partial } }));
    },
    /** Shallow-merge into one question. */
    patchQuestion<K extends keyof DepositComplaintState['questions']>(
      key: K,
      partial: Partial<DepositComplaintState['questions'][K]>,
    ) {
      update((s) => ({
        ...s,
        questions: { ...s.questions, [key]: { ...s.questions[key], ...partial } },
      }));
    },
  };
}
