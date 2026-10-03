import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { WIN_ANSI } from '../../src/core/pdf/text.ts';
import { DISCLAIMER_VERSION } from '../../src/forms/ct-dob-security-deposit/config.ts';
import {
  acceptDisclaimer,
  isDisclaimerAccepted,
} from '../../src/forms/ct-dob-security-deposit/disclaimer.ts';
import { TEXT_FIELDS } from '../../src/forms/ct-dob-security-deposit/field-map.ts';
import {
  buildComplaintPacket,
  DisclaimerNotAcceptedError,
} from '../../src/forms/ct-dob-security-deposit/packet.ts';
import {
  type DepositComplaintState,
  initialState,
} from '../../src/forms/ct-dob-security-deposit/schema.ts';
import { STEP_IDS } from '../../src/forms/ct-dob-security-deposit/steps/ids.ts';
import {
  canSend,
  type Issue,
  missingRequired,
  softWarnings,
} from '../../src/forms/ct-dob-security-deposit/validation.ts';
import {
  collectUnsupportedChars,
  textValue,
} from '../../src/forms/ct-dob-security-deposit/values.ts';
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
      ['complaintTypes', 'situation.movedOut'],
      ['tenant.name', 'aboutYou.name'],
      ['tenant.street', 'aboutYou.address'],
      ['tenant.city', 'aboutYou.address'],
      ['tenant.state', 'aboutYou.address'],
      ['tenant.zip', 'aboutYou.address'],
      ['landlord.name', 'landlord.name'],
      ['rental.unitStreet', 'rental.address'],
      ['rental.city', 'rental.address'],
      ['rental.zip', 'rental.address'],
      ['disclaimer', 'disclaimer'],
      ['statementsRead', 'sign.statements'],
      ['signature', 'sign.signature'],
    ]);
    expect(canSend(initialState())).toBe(false);
  });

  it('allows Send only when everything is present', () => {
    expect(missingRequired(ready(type1NoAnswers))).toEqual([]);
    expect(canSend(ready(type1NoAnswers))).toBe(true);
  });

  it('accepts a typed signature in place of a drawn one (§14)', () => {
    const state = ready(type1NoAnswers);
    const typed = (typedName: string): DepositComplaintState => ({
      ...state,
      signature: { ...state.signature, method: 'typed', pngDataUrl: null, typedName },
    });
    expect(canSend(typed('Jane Doe'))).toBe(true);
    expect(ids(missingRequired(typed(' ')))).toEqual(['signature']);
  });

  it('warns about characters a typed signature cannot print', () => {
    const state = makeState({ signature: { method: 'typed', typedName: 'Łukasz' } });
    expect(warnings(state).filter((i) => i.id === 'chars.signature')).toEqual([
      {
        id: 'chars.signature',
        step: 'sign.signature',
        label: 'Signature',
        message: "The form can't print 'Ł'. Please use a plain letter instead.",
      },
    ]);
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

  it('points every issue at a real page', () => {
    const all = [...missingRequired(initialState()), ...warnings(initialState())];
    expect(all.length).toBeGreaterThan(0);
    for (const issue of all) expect(STEP_IDS).toContain(issue.step);
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
    expect(w.map((i) => i.step)).toEqual([
      'documents.depositProof',
      'documents.correspondence',
      'documents.forwardingAddress',
    ]);
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
        step: 'landlord.address',
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
  const movedOut = (answer: 'yes' | 'no' | null) =>
    makeState({ gates: { movedOut: answer }, rental: { moveOutDate: null } });
  const flagged = (state: DepositComplaintState) =>
    ids(warnings(state)).includes('rental.moveOutDate');

  it('is noted unless the tenant still lives there', () => {
    expect(flagged(initialState())).toBe(true);
    expect(flagged(movedOut(null))).toBe(true);
    expect(flagged(movedOut('yes'))).toBe(true);
    expect(flagged(movedOut('no'))).toBe(false);
  });
});

describe('other deposit', () => {
  const state = (paid: 'yes' | 'no' | null, cents: number | null) =>
    makeState({ gates: { otherDepositPaid: paid }, rental: { otherDepositCents: cents } });

  it('shows $0.00 on No, with no empty warning, keeping any typed amount', () => {
    const no = state('no', 12500);
    expect(textValue('rental.otherDepositCents', no)).toBe('$0.00');
    expect(no.rental.otherDepositCents).toBe(12500);
    expect(ids(warnings(no))).not.toContain('rental.otherDepositCents');
  });

  it('shows the typed amount on Yes, and notes an empty one', () => {
    expect(textValue('rental.otherDepositCents', state('yes', 12500))).toBe('$125.00');
    expect(ids(warnings(state('yes', null)))).toContain('rental.otherDepositCents');
  });

  it('prints $0.00 in the form field on No', async () => {
    const packet = await buildComplaintPacket(
      state('no', 12500),
      {},
      { mode: 'preview', assets: loadAssets(), flatten: false },
    );
    const form = (await PDFDocument.load(packet.bytes)).getForm();
    const entry = TEXT_FIELDS.find((f) => f.path === 'rental.otherDepositCents');
    expect(form.getTextField(entry?.field ?? '').getText()).toBe('$0.00');
  });
});
