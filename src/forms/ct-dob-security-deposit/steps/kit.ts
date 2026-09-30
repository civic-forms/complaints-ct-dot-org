// Small helpers the pages share for wiring fields to state and messages.

import type { Unprintable } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import { t } from '../../../i18n/t.ts';
import type { TextPath } from '../fieldMap.ts';
import type { DepositComplaintState, Person } from '../schema.ts';
import { inlineMessages, unprintableMessage } from '../validation.ts';
import type { StepProps } from './types.ts';

/** "On the form: Move In Date" */
export const onTheForm = (label: string) => t(en.common.onTheForm, { label });

export function kit({ unsupported, warnings, update, pageError }: StepProps) {
  return {
    /** The unprintable-character message for a field (null when none). */
    chars(path: TextPath): Unprintable | null {
      const entry = unsupported.find((u) => u.path === path);
      return entry ? { key: entry.chars.join(''), message: unprintableMessage(entry.chars) } : null;
    },
    inline: (id: string) => inlineMessages(warnings, id),
    errorId: pageError,
    /** Shallow-merge into one top-level section of state. */
    patch<K extends 'tenant' | 'landlord' | 'rental' | 'signature' | 'forwardingAddress' | 'gates'>(
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

export type AddressKey = keyof Person;

/**
 * Input attributes for the tenant's and landlord's fields (§7). The tenant gets
 * full autocomplete tokens. The landlord's fields get autocomplete="off" and
 * neutral ids and names, so browsers don't offer the tenant's own saved address.
 */
export function addressAttrs(
  who: 'tenant' | 'landlord',
  key: AddressKey,
): { id: string; name: string; autoComplete: string } {
  if (who === 'landlord') {
    const n = LANDLORD_ORDER.indexOf(key) + 1;
    return { id: `ll-${n}`, name: `ll-${n}`, autoComplete: 'off' };
  }
  return { id: `tenant-${key}`, name: TENANT_TOKENS[key], autoComplete: TENANT_TOKENS[key] };
}

const TENANT_TOKENS: Record<AddressKey, string> = {
  name: 'name',
  street: 'street-address',
  city: 'address-level2',
  state: 'address-level1',
  zip: 'postal-code',
  daytimePhone: 'tel',
  email: 'email',
};

const LANDLORD_ORDER: readonly AddressKey[] = [
  'name',
  'street',
  'city',
  'state',
  'zip',
  'daytimePhone',
  'email',
];
