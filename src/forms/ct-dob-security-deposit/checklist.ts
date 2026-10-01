// Evidence slots derived mechanically from the form's page 3 checklist and the
// user's own answers (CLAUDE.md §2.2, §8.4). Labels are the form's words,
// verbatim; the two app-defined slots are marked `appDefined`.

import en from '../../i18n/en.json' with { type: 'json' };
import type { DepositComplaintState } from './schema.ts';
import verbatim from './verbatim.json' with { type: 'json' };

export type SlotId =
  | 'depositProof'
  | 'rentalAgreement'
  | 'correspondence'
  | 'forwardingAddress'
  | 'proofOfAge'
  | 'overageLetter62'
  | 'overageLetter'
  | 'escrowLetter'
  | 'certifiedMailReceipt'
  | 'certifiedMailReturnReceipt'
  | 'cashForKeysAgreement'
  | 'other';

export interface EvidenceSlot {
  id: SlotId;
  label: string;
  /** Empty slots show a soft warning on Review unless this is false. Never blocks Send. */
  warnIfEmpty: boolean;
  /** Default of the per-slot grayscale toggle (§8.5). */
  grayscaleDefault: boolean;
  hint?: string;
  note?: string;
  help?: string;
  appDefined?: true;
}

const c = verbatim.checklist;
const [depositProof, rentalAgreement, correspondence] = c.all as [string, string, string];
const [proofOfAge, overageLetter62] = c.currentTenant62PlusExcessOverOneMonth as [string, string];
const [overageLetter] = c.currentTenantUnder62ExcessOverTwoMonths as [string];
const [escrowLetter] = c.currentTenantNoEscrowInfo as [string];
const [forwardingAddress] = c.formerTenantDepositNotReturned as [string];
// The three current-tenant types each end with the same two certified-mail lines.
const [, , certifiedReceipt, certifiedReturnReceipt] = c.currentTenant62PlusExcessOverOneMonth as [
  string,
  string,
  string,
  string,
];

const doc = (id: SlotId, label: string, extra: Partial<EvidenceSlot> = {}): EvidenceSlot => ({
  id,
  label,
  warnIfEmpty: true,
  grayscaleDefault: true,
  ...extra,
});

/** Ordered, deduplicated upload slots for this state. */
export function deriveSlots(state: DepositComplaintState): EvidenceSlot[] {
  const types = state.complaintTypes;
  const slots: EvidenceSlot[] = [
    doc('depositProof', depositProof),
    // The form's label itself says "if available".
    doc('rentalAgreement', rentalAgreement, { warnIfEmpty: false }),
    doc(
      'correspondence',
      correspondence,
      state.questions.correspondenceReceived.answer === 'yes'
        ? { hint: en.slots.correspondenceHint }
        : {},
    ),
  ];
  if (types.formerTenantDepositNotReturned) {
    slots.push(doc('forwardingAddress', forwardingAddress));
  }
  if (types.currentTenant62PlusExcessOverOneMonth) {
    slots.push(doc('proofOfAge', proofOfAge, { note: en.slots.proofOfAgeNote }));
    slots.push(doc('overageLetter62', overageLetter62));
  }
  if (types.currentTenantUnder62ExcessOverTwoMonths) {
    slots.push(doc('overageLetter', overageLetter));
  }
  if (types.currentTenantNoEscrowInfo) {
    slots.push(doc('escrowLetter', escrowLetter));
  }
  if (
    types.currentTenant62PlusExcessOverOneMonth ||
    types.currentTenantUnder62ExcessOverTwoMonths ||
    types.currentTenantNoEscrowInfo
  ) {
    slots.push(doc('certifiedMailReceipt', certifiedReceipt));
    slots.push(doc('certifiedMailReturnReceipt', certifiedReturnReceipt));
  }
  if (state.questions.cashForKeys.answer === 'yes') {
    slots.push(doc('cashForKeysAgreement', en.slots.cashForKeysAgreement, { appDefined: true }));
  }
  // App-defined, always last and optional. A single entry, so it can be removed if DOB asks.
  slots.push(
    doc('other', en.slots.other, {
      warnIfEmpty: false,
      grayscaleDefault: false,
      help: en.slots.otherHelp,
      appDefined: true,
    }),
  );
  return slots;
}
