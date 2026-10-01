// The page registry without UI (CLAUDE.md §7): which chapter each page is in,
// when it appears, what answer it needs before Continue, and which form fields
// it is the single source for. index.ts adds titles and components.

import { deriveSlots, type SlotId } from '../checklist.ts';
import type { TextPath, YesNoQuestion } from '../field-map.ts';
import type { ComplaintType, DepositComplaintState } from '../schema.ts';
import { anyChecked, isChecked, isReachable } from '../situation.ts';
import type { ChapterId, StepId } from './ids.ts';

type State = DepositComplaintState;

/** A printed field (or drawn item) on the form, by where its value comes from. */
export type FormPath =
  | TextPath
  | `yesNo.${YesNoQuestion}`
  | 'cashForKeys'
  | 'typeOfRental'
  | 'terms.lease'
  | 'terms.monthToMonth'
  | `complaintType.${ComplaintType}`
  | 'signature'
  | 'signedDate';

/**
 * What Continue needs (§7). `choice`: a selected option; `info`: every
 * non-optional field on the page. Skippable pages also offer "Skip for now".
 * Pages without a rule (intros, notes, optional fields) always continue.
 */
export interface AnswerRule {
  kind: 'choice' | 'info';
  skippable: boolean;
  done: (s: State) => boolean;
}

export interface PageSpec {
  id: StepId;
  /** null only for Welcome. */
  chapter: ChapterId | null;
  /** `note`: a conditional notice, not counted in chapter progress. */
  kind: 'intro' | 'page' | 'note';
  /** Relevant for these answers; always, when absent. */
  when?: (s: State) => boolean;
  answer?: AnswerRule;
  /** Form fields this page is the single source question for. */
  fills?: readonly FormPath[];
  /** Only reached through the Review edit detour, never in the normal flow. */
  detourOnly?: true;
}

const appChoice = (done: (s: State) => boolean): AnswerRule => ({
  kind: 'choice',
  skippable: false,
  done,
});
const formChoice = (done: (s: State) => boolean): AnswerRule => ({
  kind: 'choice',
  skippable: true,
  done,
});
const info = (done: (s: State) => boolean): AnswerRule => ({ kind: 'info', skippable: true, done });

const present = (value: string) => value.trim() !== '';
const answered = (value: string | null) => value !== null;

const movedOut = (s: State) => s.gates.movedOut === 'yes';
const stillThere = (s: State) => s.gates.movedOut === 'no';
const returnedYes = (s: State) => s.questions.depositReturned.answer === 'yes';
const formerChecked = (s: State) => isChecked(s, 'formerTenantDepositNotReturned');
const fwd = (s: State) => s.forwardingAddress;

const CURRENT_TENANT_TYPES: readonly ComplaintType[] = [
  'currentTenant62PlusExcessOverOneMonth',
  'currentTenantUnder62ExcessOverTwoMonths',
  'currentTenantNoEscrowInfo',
];

const confirmPage = (id: StepId, chapter: ChapterId, type: ComplaintType): PageSpec => ({
  id,
  chapter,
  kind: 'page',
  when: (s) => isReachable(s, type),
  answer: appChoice((s) => answered(s.gates.confirmed[type])),
  fills: [`complaintType.${type}`],
});

const addressDone = (a: {
  street?: string;
  unitStreet?: string;
  city: string;
  state: string;
  zip: string;
}) => [a.street ?? a.unitStreet ?? '', a.city, a.state, a.zip].every(present);

const slotPage = (slot: SlotId): PageSpec => ({
  id: `documents.${slot}` as StepId,
  chapter: 'documents',
  kind: 'page',
  when: (s) => deriveSlots(s).some((d) => d.id === slot),
});

const SLOT_IDS: readonly SlotId[] = [
  'depositProof',
  'rentalAgreement',
  'correspondence',
  'forwardingAddress',
  'proofOfAge',
  'overageLetter62',
  'overageLetter',
  'escrowLetter',
  'certifiedMailReceipt',
  'certifiedMailReturnReceipt',
  'cashForKeysAgreement',
  'other',
];

const intro = (chapter: ChapterId): PageSpec => ({
  id: `${chapter}.intro` as StepId,
  chapter,
  kind: 'intro',
});

export const PAGE_SPECS: readonly PageSpec[] = [
  { id: 'welcome', chapter: null, kind: 'page' },

  // Your situation: moved out; for current tenants, the gates and confirmations.
  intro('situation'),
  {
    id: 'situation.movedOut',
    chapter: 'situation',
    kind: 'page',
    answer: appChoice((s) => answered(s.gates.movedOut)),
  },
  {
    id: 'situation.age62OrOlder',
    chapter: 'situation',
    kind: 'page',
    when: stillThere,
    answer: appChoice((s) => answered(s.gates.age62OrOlder)),
  },
  {
    id: 'situation.overLimitHeld',
    chapter: 'situation',
    kind: 'page',
    when: (s) => stillThere(s) && s.gates.age62OrOlder !== null,
    answer: appChoice((s) => answered(s.gates.overLimitHeld)),
  },
  confirmPage(
    'situation.confirm.currentTenant62PlusExcessOverOneMonth',
    'situation',
    'currentTenant62PlusExcessOverOneMonth',
  ),
  confirmPage(
    'situation.confirm.currentTenantUnder62ExcessOverTwoMonths',
    'situation',
    'currentTenantUnder62ExcessOverTwoMonths',
  ),
  confirmPage(
    'situation.confirm.currentTenantNoEscrowInfo',
    'situation',
    'currentTenantNoEscrowInfo',
  ),
  {
    id: 'situation.noTypeNote',
    chapter: 'situation',
    kind: 'note',
    // Only the current-tenant types: the former-tenant one is asked later, in Your deposit.
    when: (s) => stillThere(s) && !CURRENT_TENANT_TYPES.some((type) => s.complaintTypes[type]),
  },

  // Your deposit: amounts, the form's returned question, the former-tenant confirmation, interest.
  intro('deposit'),
  {
    id: 'deposit.monthlyRent',
    chapter: 'deposit',
    kind: 'page',
    answer: info((s) => s.rental.monthlyRentCents !== null),
    fills: ['rental.monthlyRentCents'],
  },
  {
    id: 'deposit.securityDeposit',
    chapter: 'deposit',
    kind: 'page',
    answer: info((s) => s.rental.securityDepositCents !== null),
    fills: ['rental.securityDepositCents'],
  },
  {
    // The field's source question: No prints $0.00, Yes leads to the amount.
    id: 'deposit.otherDepositPaid',
    chapter: 'deposit',
    kind: 'page',
    answer: appChoice((s) => answered(s.gates.otherDepositPaid)),
    fills: ['rental.otherDepositCents'],
  },
  {
    id: 'deposit.otherDeposit',
    chapter: 'deposit',
    kind: 'page',
    when: (s) => s.gates.otherDepositPaid === 'yes',
    answer: info((s) => s.rental.otherDepositCents !== null),
  },
  {
    id: 'deposit.depositReturned',
    chapter: 'deposit',
    kind: 'page',
    answer: formChoice((s) => answered(s.questions.depositReturned.answer)),
    fills: ['yesNo.depositReturned'],
  },
  {
    id: 'deposit.returnedAmount',
    chapter: 'deposit',
    kind: 'page',
    when: returnedYes,
    answer: info((s) => s.questions.depositReturned.amountCents !== null),
    fills: ['questions.depositReturned.amountCents'],
  },
  {
    id: 'deposit.checkCashed',
    chapter: 'deposit',
    kind: 'page',
    when: returnedYes,
    answer: formChoice((s) => answered(s.questions.depositReturned.checkCashed)),
    fills: ['yesNo.checkCashed'],
  },
  {
    id: 'deposit.fullAmountReturned',
    chapter: 'deposit',
    kind: 'page',
    when: (s) => movedOut(s) && returnedYes(s),
    answer: appChoice((s) => answered(s.gates.fullAmountReturned)),
  },
  confirmPage(
    'deposit.confirm.formerTenantDepositNotReturned',
    'deposit',
    'formerTenantDepositNotReturned',
  ),
  {
    id: 'deposit.noTypeNote',
    chapter: 'deposit',
    kind: 'note',
    when: (s) => movedOut(s) && !anyChecked(s),
  },
  {
    id: 'deposit.interestPaid',
    chapter: 'deposit',
    kind: 'page',
    answer: formChoice((s) => answered(s.questions.interestPaid.answer)),
    fills: ['yesNo.interestPaid'],
  },
  {
    id: 'deposit.interestPayments',
    chapter: 'deposit',
    kind: 'page',
    when: (s) => s.questions.interestPaid.answer === 'yes',
    answer: info(
      (s) =>
        s.questions.interestPaid.payments.length > 0 &&
        s.questions.interestPaid.payments.every((p) => p.date !== null && p.amountCents !== null),
    ),
    fills: ['questions.interestPaid.payments'],
  },
  { id: 'deposit.neededDocs', chapter: 'deposit', kind: 'page' },

  // Your new address: former tenants who confirmed the former-tenant type.
  intro('newAddress'),
  {
    id: 'newAddress.fwdGiven',
    chapter: 'newAddress',
    kind: 'page',
    when: formerChecked,
    answer: appChoice((s) => answered(fwd(s).fwdGiven)),
  },
  {
    id: 'newAddress.fwdInWriting',
    chapter: 'newAddress',
    kind: 'page',
    when: (s) => formerChecked(s) && fwd(s).fwdGiven === 'yes',
    answer: appChoice((s) => answered(fwd(s).fwdInWriting)),
  },
  {
    id: 'newAddress.fwdProofAvailable',
    chapter: 'newAddress',
    kind: 'page',
    when: (s) => formerChecked(s) && fwd(s).fwdGiven === 'yes' && fwd(s).fwdInWriting === 'yes',
    answer: appChoice((s) => answered(fwd(s).fwdProofAvailable)),
  },
  {
    id: 'newAddress.forwardingAddressSlot',
    chapter: 'newAddress',
    kind: 'page',
    when: (s) =>
      formerChecked(s) &&
      fwd(s).fwdGiven === 'yes' &&
      fwd(s).fwdInWriting === 'yes' &&
      fwd(s).fwdProofAvailable === 'yes',
  },

  // About you.
  intro('aboutYou'),
  {
    id: 'aboutYou.name',
    chapter: 'aboutYou',
    kind: 'page',
    answer: info((s) => present(s.tenant.name)),
    fills: ['tenant.name'],
  },
  {
    id: 'aboutYou.address',
    chapter: 'aboutYou',
    kind: 'page',
    answer: info((s) => addressDone(s.tenant)),
    fills: ['tenant.street', 'tenant.city', 'tenant.state', 'tenant.zip'],
  },
  {
    id: 'aboutYou.phone',
    chapter: 'aboutYou',
    kind: 'page',
    answer: info((s) => present(s.tenant.daytimePhone)),
    fills: ['tenant.daytimePhone'],
  },
  { id: 'aboutYou.email', chapter: 'aboutYou', kind: 'page', fills: ['tenant.email'] },

  // Your landlord.
  intro('landlord'),
  {
    id: 'landlord.name',
    chapter: 'landlord',
    kind: 'page',
    answer: info((s) => present(s.landlord.name)),
    fills: ['landlord.name'],
  },
  {
    id: 'landlord.address',
    chapter: 'landlord',
    kind: 'page',
    answer: info((s) => addressDone(s.landlord)),
    fills: ['landlord.street', 'landlord.city', 'landlord.state', 'landlord.zip'],
  },
  {
    id: 'landlord.phone',
    chapter: 'landlord',
    kind: 'page',
    answer: info((s) => present(s.landlord.daytimePhone)),
    fills: ['landlord.daytimePhone'],
  },
  { id: 'landlord.email', chapter: 'landlord', kind: 'page', fills: ['landlord.email'] },

  // The rental: address, type, terms, then the timeline.
  intro('rental'),
  {
    id: 'rental.address',
    chapter: 'rental',
    kind: 'page',
    answer: info((s) => addressDone(s.rental)),
    fills: ['rental.unitStreet', 'rental.city', 'rental.state', 'rental.zip'],
  },
  {
    id: 'rental.housingComplex',
    chapter: 'rental',
    kind: 'page',
    fills: ['rental.housingComplexName'],
  },
  {
    id: 'rental.typeOfRental',
    chapter: 'rental',
    kind: 'page',
    answer: formChoice((s) => answered(s.rental.typeOfRental)),
    fills: ['typeOfRental'],
  },
  {
    id: 'rental.terms',
    chapter: 'rental',
    kind: 'page',
    answer: formChoice((s) => s.rental.terms.lease || s.rental.terms.monthToMonth),
    fills: ['terms.lease', 'terms.monthToMonth'],
  },
  {
    id: 'rental.moveIn',
    chapter: 'rental',
    kind: 'page',
    answer: info((s) => s.rental.moveInDate !== null),
    fills: ['rental.moveInDate'],
  },
  {
    id: 'rental.moveOut',
    chapter: 'rental',
    kind: 'page',
    when: (s) => s.gates.movedOut !== 'no',
    answer: info((s) => s.rental.moveOutDate !== null),
    fills: ['rental.moveOutDate'],
  },
  {
    id: 'rental.lastRentPaid',
    chapter: 'rental',
    kind: 'page',
    answer: info((s) => s.rental.lastRentPaidDate !== null),
    fills: ['rental.lastRentPaidDate'],
  },

  // More questions: the rest of page 1, each follow-up on its own page.
  intro('moreQuestions'),
  {
    id: 'moreQuestions.cashForKeys',
    chapter: 'moreQuestions',
    kind: 'page',
    answer: formChoice((s) => answered(s.questions.cashForKeys.answer)),
    fills: ['cashForKeys'],
  },
  {
    id: 'moreQuestions.roommates',
    chapter: 'moreQuestions',
    kind: 'page',
    answer: formChoice((s) => answered(s.questions.roommates.answer)),
    fills: ['yesNo.roommates'],
  },
  {
    id: 'moreQuestions.roommateNames',
    chapter: 'moreQuestions',
    kind: 'page',
    when: (s) => s.questions.roommates.answer === 'yes',
    answer: info((s) => s.questions.roommates.names.some(present)),
    fills: ['questions.roommates.names'],
  },
  {
    id: 'moreQuestions.otherProperties',
    chapter: 'moreQuestions',
    kind: 'page',
    answer: formChoice((s) => answered(s.questions.landlordOtherProperties.answer)),
    fills: ['yesNo.landlordOtherProperties'],
  },
  {
    id: 'moreQuestions.propertyAddresses',
    chapter: 'moreQuestions',
    kind: 'page',
    when: (s) => s.questions.landlordOtherProperties.answer === 'yes',
    answer: info((s) => s.questions.landlordOtherProperties.addresses.some(present)),
    fills: ['questions.landlordOtherProperties.addresses'],
  },
  {
    id: 'moreQuestions.correspondence',
    chapter: 'moreQuestions',
    kind: 'page',
    answer: formChoice((s) => answered(s.questions.correspondenceReceived.answer)),
    fills: ['yesNo.correspondenceReceived'],
  },
  {
    id: 'moreQuestions.courtAction',
    chapter: 'moreQuestions',
    kind: 'page',
    answer: formChoice((s) => answered(s.questions.courtAction.answer)),
    fills: ['yesNo.courtAction'],
  },
  {
    id: 'moreQuestions.docketNumber',
    chapter: 'moreQuestions',
    kind: 'page',
    when: (s) => s.questions.courtAction.answer === 'yes',
    answer: info((s) => present(s.questions.courtAction.docketNumber)),
    fills: ['questions.courtAction.docketNumber'],
  },

  // Documents: one page per derived slot.
  intro('documents'),
  ...SLOT_IDS.map(slotPage),

  { id: 'comments', chapter: 'comments', kind: 'page', fills: ['additionalComments'] },
  { id: 'disclaimer', chapter: 'disclaimer', kind: 'page' },
  { id: 'review', chapter: 'review', kind: 'page' },
  {
    id: 'review.moreInfoNeeded',
    chapter: 'review',
    kind: 'page',
    when: () => false,
    detourOnly: true,
  },
  { id: 'sign.statements', chapter: 'sign', kind: 'page' },
  { id: 'sign.signature', chapter: 'sign', kind: 'page', fills: ['signature', 'signedDate'] },
];

const PAGE_OF_PATH = new Map<FormPath, StepId>(
  PAGE_SPECS.flatMap((page) => (page.fills ?? []).map((path) => [path, page.id] as const)),
);

/** The page that asks for a form field (Edit links, warnings). */
export function pageOfPath(path: FormPath): StepId {
  const id = PAGE_OF_PATH.get(path);
  if (!id) throw new Error(`No page fills ${path}`);
  return id;
}

export const specOf = (id: StepId): PageSpec => {
  const spec = PAGE_SPECS.find((p) => p.id === id);
  if (!spec) throw new Error(`Unknown page ${id}`);
  return spec;
};
