import { describe, expect, it } from 'vitest';
import { WIN_ANSI } from '../../src/core/pdf/text.ts';
import { DISCLAIMER_VERSION } from '../../src/forms/ct-dob-security-deposit/config.ts';
import {
  acceptDisclaimer,
  isDisclaimerAccepted,
} from '../../src/forms/ct-dob-security-deposit/disclaimer.ts';
import {
  buildComplaintPacket,
  DisclaimerNotAcceptedError,
} from '../../src/forms/ct-dob-security-deposit/packet.ts';
import {
  type DepositComplaintState,
  initialState,
} from '../../src/forms/ct-dob-security-deposit/schema.ts';
import {
  canSend,
  type Issue,
  missingRequired,
  softWarnings,
} from '../../src/forms/ct-dob-security-deposit/validation.ts';
import { collectUnsupportedChars } from '../../src/forms/ct-dob-security-deposit/values.ts';
import { makeState, type1NoAnswers, type23AllYes } from '../fixtures/states.ts';
import { loadAssets } from '../helpers/assets.ts';
import { pngDataUrl, signaturePng } from '../helpers/png.ts';

const TODAY = '2026-09-27';
const ids = (issues: Issue[]) => issues.map((i) => i.id);
const warnings = (state: DepositComplaintState, extra: { packetBytes?: number } = {}) =>
  softWarnings(state, {
    unsupportedChars: collectUnsupportedChars(state, WIN_ANSI),
    slotFileCounts: {},
    today: TODAY,
    ...extra,
  });
const ready = (state: DepositComplaintState): DepositComplaintState => ({
  ...state,
  signature: { ...state.signature, pngDataUrl: pngDataUrl(signaturePng()), statementsRead: true },
});

describe('hard requirements (§6.3)', () => {
  it('lists everything for a blank form, each with its step', () => {
    expect(missingRequired(initialState()).map((i) => [i.id, i.step])).toEqual([
      ['complaintTypes', 'situation'],
      ['tenant.name', 'aboutYou'],
      ['tenant.street', 'aboutYou'],
      ['tenant.city', 'aboutYou'],
      ['tenant.state', 'aboutYou'],
      ['tenant.zip', 'aboutYou'],
      ['landlord.name', 'landlord'],
      ['rental.unitStreet', 'rental'],
      ['rental.city', 'rental'],
      ['rental.zip', 'rental'],
      ['disclaimer', 'disclaimer'],
      ['statementsRead', 'sign'],
      ['signature', 'sign'],
    ]);
    expect(canSend(initialState())).toBe(false);
  });

  it('allows Send only when everything is present', () => {
    expect(missingRequired(ready(type1NoAnswers))).toEqual([]);
    expect(canSend(ready(type1NoAnswers))).toBe(true);
  });

  it.each([
    [
      'signature',
      (s: DepositComplaintState) => ({ ...s, signature: { ...s.signature, pngDataUrl: null } }),
    ],
    [
      'statementsRead',
      (s: DepositComplaintState) => ({
        ...s,
        signature: { ...s.signature, statementsRead: false },
      }),
    ],
    [
      'disclaimer',
      (s: DepositComplaintState) => ({ ...s, meta: { ...s.meta, disclaimerVersion: 'old' } }),
    ],
    ['tenant.name', (s: DepositComplaintState) => ({ ...s, tenant: { ...s.tenant, name: '  ' } })],
    [
      'complaintTypes',
      (s: DepositComplaintState) => ({
        ...s,
        complaintTypes: { ...initialState().complaintTypes },
      }),
    ],
  ])('Send is disabled while %s is missing', (id, drop) => {
    const state = drop(ready(type1NoAnswers));
    expect(ids(missingRequired(state))).toEqual([id]);
    expect(canSend(state)).toBe(false);
  });
});

describe('disclaimer gate', () => {
  it('accepts only the current version', () => {
    const state = initialState();
    expect(isDisclaimerAccepted(state)).toBe(false);
    const accepted = acceptDisclaimer(state, new Date('2026-09-27T12:00:00Z'));
    expect(accepted.meta).toMatchObject({
      disclaimerVersion: DISCLAIMER_VERSION,
      disclaimerAcceptedAt: '2026-09-27T12:00:00.000Z',
    });
    expect(isDisclaimerAccepted(accepted)).toBe(true);
    const older = { ...accepted, meta: { ...accepted.meta, disclaimerVersion: 'v-old' } };
    expect(isDisclaimerAccepted(older)).toBe(false);
  });

  it('no PDF can be built before acceptance', async () => {
    await expect(
      buildComplaintPacket(initialState(), {}, { mode: 'preview', assets: loadAssets() }),
    ).rejects.toBeInstanceOf(DisclaimerNotAcceptedError);
  });
});

describe('soft warnings (§6.3)', () => {
  it('never include hard-required fields', () => {
    const hard = new Set(ids(missingRequired(initialState())));
    expect(ids(warnings(initialState())).filter((id) => hard.has(id))).toEqual([]);
  });

  it('suggests "Unknown" only where a field can hold it', () => {
    const w = warnings(initialState());
    const message = (id: string) => w.find((i) => i.id === id)?.message;
    expect(message('landlord.daytimePhone')).toContain('Unknown');
    expect(message('landlord.city')).toContain('Unknown');
    for (const id of [
      'landlord.state',
      'landlord.zip',
      'rental.moveInDate',
      'rental.monthlyRentCents',
    ]) {
      expect(message(id)).toBe('The form asks for this.');
    }
    expect(w.some((i) => i.id.endsWith('email'))).toBe(false); // emails are optional
    expect(w.some((i) => i.id === 'rental.housingComplexName')).toBe(false);
  });

  it('notes box 1 with boxes 2–4, and boxes 2 and 3 together', () => {
    const both = makeState({
      complaintTypes: {
        formerTenantDepositNotReturned: true,
        currentTenant62PlusExcessOverOneMonth: true,
        currentTenantUnder62ExcessOverTwoMonths: true,
      },
    });
    const w = warnings(both);
    expect(ids(w)).toContain('box1WithCurrent');
    expect(ids(w)).toContain('box2And3');
    expect(w.find((i) => i.id === 'box1WithCurrent')).toMatchObject({
      step: 'situation',
      inline: true,
    });
    expect(ids(warnings(type1NoAnswers))).not.toContain('box1WithCurrent');
  });

  it('flags move-out before move-in and future dates', () => {
    const state = makeState({
      rental: {
        moveInDate: '2026-10-01',
        moveOutDate: '2026-09-01',
        lastRentPaidDate: '2026-09-27',
      },
      signature: { signedDate: '2026-09-28' },
    });
    const w = warnings(state);
    const on = (id: string) => w.filter((i) => i.id === id).map((i) => i.message);
    expect(on('rental.moveOutDate')).toEqual(['The move-out date is before the move-in date.']);
    expect(on('rental.moveInDate')).toEqual(['This date is in the future.']);
    expect(on('rental.lastRentPaidDate')).toEqual([]); // today is not in the future
    expect(on('signature.signedDate')).toEqual(['This date is in the future.']);
  });

  it('flags a YES with its follow-up empty, and not a NO', () => {
    const state = makeState({
      questions: {
        depositReturned: { answer: 'yes', amountCents: null, checkCashed: null },
        interestPaid: { answer: 'yes', payments: [{ date: null, amountCents: null }] },
        roommates: { answer: 'yes', names: ['  '] },
        landlordOtherProperties: { answer: 'no', addresses: [] },
        courtAction: { answer: 'yes', docketNumber: '' },
      },
    });
    const w = ids(warnings(state));
    expect(w).toContain('questions.depositReturned.amountCents');
    expect(w).toContain('questions.depositReturned.checkCashed');
    expect(w).toContain('questions.interestPaid.payments');
    expect(w).toContain('questions.roommates.names');
    expect(w).toContain('questions.courtAction.docketNumber');
    expect(w).not.toContain('questions.landlordOtherProperties.addresses');
    expect(ids(warnings(type23AllYes)).filter((id) => id.startsWith('questions.'))).toEqual([]);
  });

  it('flags empty evidence slots except the optional ones', () => {
    const w = warnings(type1NoAnswers).filter((i) => i.id.startsWith('slot.'));
    expect(ids(w)).toEqual(['slot.depositProof', 'slot.correspondence', 'slot.forwardingAddress']);
    expect(w.every((i) => i.step === 'documents')).toBe(true);
    const filled = softWarnings(type1NoAnswers, {
      unsupportedChars: [],
      slotFileCounts: { depositProof: 1, correspondence: 2, forwardingAddress: 1 },
      today: TODAY,
    });
    expect(ids(filled).filter((id) => id.startsWith('slot.'))).toEqual([]);
  });

  it('includes characters the form cannot print, on the step where they were typed', () => {
    const state = makeState({ landlord: { city: 'Wrocław' }, additionalComments: 'ok ✓' });
    const w = warnings(state).filter((i) => i.id.startsWith('chars.'));
    expect(w).toEqual([
      {
        id: 'chars.landlord.city',
        step: 'landlord',
        label: 'City/Town',
        message: "The form can't print 'ł'. Please use a plain letter instead.",
      },
      expect.objectContaining({ id: 'chars.additionalComments', step: 'comments' }),
    ]);
  });

  it('reports packet size near and over the budget', () => {
    const MB = 1024 * 1024;
    const budget = (bytes: number) =>
      warnings(type1NoAnswers, { packetBytes: bytes }).find((i) => i.id === 'budget');
    expect(budget(5 * MB)).toBeUndefined();
    expect(budget(8.5 * MB)?.message).toContain('8.5 MB');
    expect(budget(12 * MB)?.message).toContain("don't accept");
  });
});

describe('empty Move Out Date', () => {
  const types = (on: Partial<DepositComplaintState['complaintTypes']>) =>
    makeState({ complaintTypes: on, rental: { moveOutDate: null } });
  const flagged = (state: DepositComplaintState) =>
    ids(warnings(state)).includes('rental.moveOutDate');

  it('is noted when box 1 is checked or no type is chosen yet', () => {
    expect(flagged(initialState())).toBe(true);
    expect(flagged(types({ formerTenantDepositNotReturned: true }))).toBe(true);
    expect(
      flagged(types({ formerTenantDepositNotReturned: true, currentTenantNoEscrowInfo: true })),
    ).toBe(true);
  });

  it('is not noted when only boxes 2–4 are checked', () => {
    expect(flagged(types({ currentTenant62PlusExcessOverOneMonth: true }))).toBe(false);
    expect(
      flagged(
        types({ currentTenantUnder62ExcessOverTwoMonths: true, currentTenantNoEscrowInfo: true }),
      ),
    ).toBe(false);
  });
});
