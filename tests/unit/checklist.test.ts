import { describe, expect, it } from 'vitest';
import { deriveSlots } from '../../src/forms/ct-dob-security-deposit/checklist.ts';
import { COMPLAINT_TYPES } from '../../src/forms/ct-dob-security-deposit/schema.ts';
import verbatim from '../../src/forms/ct-dob-security-deposit/verbatim.json' with { type: 'json' };
import { makeState } from '../fixtures/states.ts';

const ids = (state: ReturnType<typeof makeState>) => deriveSlots(state).map((s) => s.id);

/** All 16 combinations of the four complaint types. */
const combos = Array.from({ length: 16 }, (_, mask) =>
  Object.fromEntries(COMPLAINT_TYPES.map((type, bit) => [type, Boolean(mask & (1 << bit))])),
);

describe('deriveSlots', () => {
  it.each(combos.map((c) => [JSON.stringify(c), c] as const))('%s', (_, types) => {
    const slots = ids(makeState({ complaintTypes: types }));
    const expected = ['depositProof', 'rentalAgreement', 'correspondence'];
    if (types.formerTenantDepositNotReturned) expected.push('forwardingAddress');
    if (types.currentTenant62PlusExcessOverOneMonth) expected.push('proofOfAge', 'overageLetter62');
    if (types.currentTenantUnder62ExcessOverTwoMonths) expected.push('overageLetter');
    if (types.currentTenantNoEscrowInfo) expected.push('escrowLetter');
    if (
      types.currentTenant62PlusExcessOverOneMonth ||
      types.currentTenantUnder62ExcessOverTwoMonths ||
      types.currentTenantNoEscrowInfo
    ) {
      expected.push('certifiedMailReceipt', 'certifiedMailReturnReceipt');
    }
    expected.push('other');
    expect(slots).toEqual(expected);
    expect(new Set(slots).size).toBe(slots.length); // deduped
  });

  it('uses the form checklist labels verbatim', () => {
    const slots = deriveSlots(
      makeState({
        complaintTypes: {
          formerTenantDepositNotReturned: true,
          currentTenant62PlusExcessOverOneMonth: true,
          currentTenantUnder62ExcessOverTwoMonths: true,
          currentTenantNoEscrowInfo: true,
        },
      }),
    );
    const formLabels = new Set(Object.values(verbatim.checklist).flat());
    for (const slot of slots) {
      if (slot.appDefined) continue;
      expect(formLabels.has(slot.label), slot.label).toBe(true);
    }
  });

  it('adds the Cash for Keys slot only for YES', () => {
    for (const answer of ['no', 'not_sure', null] as const) {
      expect(ids(makeState({ questions: { cashForKeys: { answer } } }))).not.toContain(
        'cashForKeysAgreement',
      );
    }
    const slots = ids(makeState({ questions: { cashForKeys: { answer: 'yes' } } }));
    expect(slots.at(-2)).toBe('cashForKeysAgreement');
  });

  it('adds the envelope hint only when correspondence was received', () => {
    const hint = (answer: 'yes' | 'no' | null) =>
      deriveSlots(makeState({ questions: { correspondenceReceived: { answer } } })).find(
        (s) => s.id === 'correspondence',
      )?.hint;
    expect(hint('yes')).toBe('include the envelope');
    expect(hint('no')).toBeUndefined();
    expect(hint(null)).toBeUndefined();
  });

  it('keeps "Other documents" last, optional, and in color', () => {
    const other = deriveSlots(makeState()).at(-1);
    expect(other).toMatchObject({ id: 'other', warnIfEmpty: false, grayscaleDefault: false });
  });
});
