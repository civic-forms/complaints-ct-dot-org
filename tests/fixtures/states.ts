// Fixture states for tests and sample PDFs. All people, addresses, and numbers
// are fictional.

import { DISCLAIMER_VERSION } from '../../src/forms/ct-dob-security-deposit/config.ts';
import {
  type DepositComplaintState,
  initialState,
} from '../../src/forms/ct-dob-security-deposit/schema.ts';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function merge<T>(base: T, patch: DeepPartial<T>): T {
  const out = structuredClone(base) as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    const current = out[key];
    out[key] =
      value && typeof value === 'object' && !Array.isArray(value) && current
        ? merge(current, value as DeepPartial<typeof current>)
        : value;
  }
  return out as T;
}

/** initialState() with the disclaimer accepted, plus a patch. */
export function makeState(patch: DeepPartial<DepositComplaintState> = {}): DepositComplaintState {
  return merge(
    merge(initialState(), {
      meta: { disclaimerVersion: DISCLAIMER_VERSION, disclaimerAcceptedAt: '2026-09-01T12:00:00Z' },
    }),
    patch,
  );
}

const baseTenant = {
  name: 'Jordan Q. Sample',
  street: '12 Example Lane',
  streetLine2: 'Apt 3',
  city: 'Springfield',
  state: 'MA',
  zip: '01101',
  daytimePhone: '4135550123',
  email: 'jordan.sample@example.com',
};

const baseLandlord = {
  name: 'Placeholder Properties LLC',
  street: '400 Fictional Ave',
  streetLine2: 'Suite 200',
  city: 'New Haven',
  state: 'CT',
  zip: '06510',
  daytimePhone: '203-555-0199',
  email: '',
};

const baseRental = {
  unitStreet: '77 Imaginary St',
  streetLine2: 'Unit 2B',
  housingComplexName: '',
  city: 'Hartford',
  state: 'CT',
  zip: '06103',
  typeOfRental: 'residential' as const,
  terms: { lease: true, monthToMonth: false },
  moveInDate: '2023-06-01',
  moveOutDate: '2026-05-31',
  monthlyRentCents: 145000,
  lastRentPaidDate: '2026-05-01',
  securityDepositCents: 290000,
  otherDepositCents: null,
};

/** Box 1, mostly NO answers, Cash for Keys NOT SURE. */
export const type1NoAnswers = makeState({
  complaintTypes: { formerTenantDepositNotReturned: true },
  tenant: baseTenant,
  landlord: baseLandlord,
  rental: baseRental,
  questions: {
    cashForKeys: { answer: 'not_sure' },
    depositReturned: { answer: 'no', amountCents: 50000, checkCashed: 'yes' }, // follow-ups hidden
    landlordOtherProperties: { answer: 'no', addresses: ['1 Hidden Rd'] },
    interestPaid: { answer: 'no', payments: [] },
    roommates: { answer: 'no', names: [] },
    correspondenceReceived: { answer: 'no' },
    courtAction: { answer: 'no', docketNumber: 'HFH-CV-00-0000000' },
  },
  additionalComments: 'I moved out on May 31 and returned the keys the same day.',
  signature: { signedDate: '2026-09-27' },
});

/** Boxes 2 and 3, every follow-up filled, long values that shrink to fit. */
export const type23AllYes = makeState({
  complaintTypes: {
    currentTenant62PlusExcessOverOneMonth: true,
    currentTenantUnder62ExcessOverTwoMonths: true,
  },
  tenant: {
    ...baseTenant,
    name: 'Alexandra Maximiliana Featherstonehaugh-Worthington',
    street: '1234 Extraordinarily Long Boulevard Name, Building C, Apartment 1107',
    state: 'CT',
    city: 'West Hartford',
    zip: '06107-1234',
  },
  landlord: { ...baseLandlord, daytimePhone: 'Unknown', email: 'rentals@placeholder.example' },
  rental: {
    ...baseRental,
    housingComplexName: 'The Residences at Imaginary Commons',
    terms: { lease: true, monthToMonth: true },
    moveOutDate: null,
  },
  questions: {
    cashForKeys: { answer: 'yes' },
    depositReturned: { answer: 'yes', amountCents: 125050, checkCashed: 'no' },
    landlordOtherProperties: {
      answer: 'yes',
      addresses: ['10 Sample Rd, Hartford', '22 Test Ct, Bristol'],
    },
    interestPaid: {
      answer: 'yes',
      payments: [
        { date: '2024-01-15', amountCents: 1234 },
        { date: '2025-01-15', amountCents: 1510 },
        { date: '2026-01-15', amountCents: 1602 },
      ],
    },
    roommates: { answer: 'yes', names: ['Casey Example', 'Riley Placeholder'] },
    correspondenceReceived: { answer: 'yes' },
    courtAction: { answer: 'yes', docketNumber: 'HFH-CV-26-6012345-S' },
  },
  additionalComments: 'Letters sent by certified mail on 03/01/26 and 04/15/26.',
  signature: { signedDate: '2026-09-27' },
});

/** Box 4, Cash for Keys NO, Vacation rental, both terms, other answers blank. */
export const type4CashForKeysNo = makeState({
  complaintTypes: { currentTenantNoEscrowInfo: true },
  tenant: baseTenant,
  landlord: baseLandlord,
  rental: {
    ...baseRental,
    typeOfRental: 'vacation',
    terms: { lease: true, monthToMonth: true },
    moveOutDate: null,
  },
  questions: {
    cashForKeys: { answer: 'no' },
    correspondenceReceived: { answer: 'yes' },
    depositReturned: { answer: 'yes', amountCents: 10000, checkCashed: 'yes' },
  },
  signature: { signedDate: '2026-09-27' },
});

const longParagraph =
  'This is fictional sample text for testing how long comments continue on an extra page. ' +
  'It repeats so the Additional Comments field overflows its box on the form. ';

/** Overflow: 3,500+ character comments, long lists, a state too long for its box. */
export const overflow = makeState({
  complaintTypes: { formerTenantDepositNotReturned: true },
  tenant: { ...baseTenant, state: 'Massachusetts' },
  landlord: baseLandlord,
  rental: baseRental,
  questions: {
    cashForKeys: { answer: 'no' },
    depositReturned: { answer: 'no', amountCents: null, checkCashed: null },
    landlordOtherProperties: {
      answer: 'yes',
      addresses: Array.from(
        { length: 8 },
        (_, i) => `${100 + i} Nonexistent Parkway, Suite ${i + 1}, Anytown CT 06000`,
      ),
    },
    interestPaid: { answer: 'no', payments: [] },
    roommates: {
      answer: 'yes',
      names: Array.from({ length: 12 }, (_, i) => `Roommate Number ${i + 1} Placeholder`),
    },
    correspondenceReceived: { answer: 'no' },
    courtAction: { answer: 'no', docketNumber: '' },
  },
  additionalComments: `${longParagraph.repeat(20)}\n\nA second paragraph after a blank line.`,
  signature: { signedDate: '2026-09-27' },
});

/** Box 1 with nothing uploaded (index page says no documents are attached). */
export const noAttachments = makeState({
  complaintTypes: { formerTenantDepositNotReturned: true },
  tenant: baseTenant,
  landlord: baseLandlord,
  rental: baseRental,
  questions: { cashForKeys: { answer: 'no' } },
  signature: { signedDate: '2026-09-27' },
});

export const FIXTURES = {
  'type1-no-answers': type1NoAnswers,
  'type2-3-all-yes': type23AllYes,
  'type4-cfk-no': type4CashForKeysNo,
  overflow,
  'no-attachments': noAttachments,
} as const;
