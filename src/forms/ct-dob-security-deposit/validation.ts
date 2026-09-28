// Validation (CLAUDE.md §6.3). Hard requirements block Send only, never step
// navigation. Soft warnings never block and are phrased as observations, never
// as advice about which answer is right (§2.2).

import { budgetStatus } from '../../core/pdf/budget.ts';
import en from '../../i18n/en.json' with { type: 'json' };
import { t } from '../../i18n/t.ts';
import { deriveSlots, type SlotId } from './checklist.ts';
import { isDisclaimerAccepted } from './disclaimer.ts';
import type { DepositComplaintState, ISODate } from './schema.ts';
import { type StepId, stepOfPath } from './steps/ids.ts';
import type { UnsupportedChars } from './values.ts';
import verbatim from './verbatim.json' with { type: 'json' };

export interface Issue {
  /** Stable key: a schema path ("tenant.name"), "slot.<id>", "chars.<path>", or a rule name. */
  id: string;
  step: StepId;
  /** What the issue is about (usually the form's label); null when the message says it all. */
  label: string | null;
  message: string;
  /** Also shown under the field as the user types (not just on Review). */
  inline?: true;
}

const labels = verbatim.fieldLabels;
const q = verbatim.page1Labels;
const req = en.validation.required;
const warn = en.validation.warnings;

const blank = (s: string) => s.trim() === '';

/** §6.3 hard requirements still missing. Send stays disabled until this is empty. */
export function missingRequired(state: DepositComplaintState): Issue[] {
  const issues: Issue[] = [];
  const need = (missing: boolean, id: string, step: StepId, label: string) => {
    if (missing) issues.push({ id, step, label, message: '' });
  };
  need(
    !Object.values(state.complaintTypes).some(Boolean),
    'complaintTypes',
    'situation',
    req.complaintType,
  );
  const { tenant, landlord, rental } = state;
  need(blank(tenant.name), 'tenant.name', 'aboutYou', labels.tenant.name);
  need(blank(tenant.street), 'tenant.street', 'aboutYou', labels.tenant.street);
  need(blank(tenant.city), 'tenant.city', 'aboutYou', labels.tenant.city);
  need(blank(tenant.state), 'tenant.state', 'aboutYou', labels.tenant.state);
  need(blank(tenant.zip), 'tenant.zip', 'aboutYou', labels.tenant.zip);
  need(blank(landlord.name), 'landlord.name', 'landlord', labels.landlord.name);
  need(blank(rental.unitStreet), 'rental.unitStreet', 'rental', labels.rental.unitStreet);
  need(blank(rental.city), 'rental.city', 'rental', labels.rental.city);
  need(blank(rental.zip), 'rental.zip', 'rental', labels.rental.zip);
  need(!isDisclaimerAccepted(state), 'disclaimer', 'disclaimer', req.disclaimer);
  need(!state.signature.statementsRead, 'statementsRead', 'sign', req.statementsRead);
  need(!state.signature.pngDataUrl, 'signature', 'sign', req.signature);
  return issues;
}

export function canSend(state: DepositComplaintState): boolean {
  return missingRequired(state).length === 0;
}

export interface WarningInputs {
  /** From collectUnsupportedChars(state, WIN_ANSI). */
  unsupportedChars: readonly UnsupportedChars[];
  /** Files added per evidence slot (uploads arrive in Phase 4). */
  slotFileCounts: Partial<Record<SlotId, number>>;
  /** Size of the last built packet, if any. */
  packetBytes?: number | null;
  /** ISO date; defaults to the user's today. */
  today: string;
}

/** "'ł', 'ő'" for messages. */
export function formatChars(chars: readonly string[]): string {
  return chars.map((char) => t(en.common.charQuote, { char })).join(en.common.listJoin);
}

export function unprintableMessage(chars: readonly string[]): string {
  return t(en.common.unprintable, { chars: formatChars(chars) });
}

/** §6.3 soft warnings, in step order. */
export function softWarnings(state: DepositComplaintState, inputs: WarningInputs): Issue[] {
  const issues: Issue[] = [];
  const add = (id: string, step: StepId, label: string | null, message: string, inline = false) =>
    issues.push({ id, step, label, message, ...(inline ? { inline: true as const } : {}) });
  const types = state.complaintTypes;
  const { tenant, landlord, rental, questions: qs } = state;

  // Step 1: neutral consistency notes.
  if (
    types.formerTenantDepositNotReturned &&
    (types.currentTenant62PlusExcessOverOneMonth ||
      types.currentTenantUnder62ExcessOverTwoMonths ||
      types.currentTenantNoEscrowInfo)
  ) {
    add('box1WithCurrent', 'situation', null, warn.box1WithCurrent, true);
  }
  if (
    types.currentTenant62PlusExcessOverOneMonth &&
    types.currentTenantUnder62ExcessOverTwoMonths
  ) {
    add('box2And3', 'situation', null, warn.box2And3, true);
  }

  // Empty fields the form asks for (hard-required ones are listed separately).
  // Fixed-format fields (State, Zip, dates, money, choices) can't hold "Unknown".
  const emptyText = (value: string, id: string, step: StepId, label: string) => {
    if (blank(value)) add(id, step, label, warn.empty);
  };
  const emptyFixed = (empty: boolean, id: string, step: StepId, label: string) => {
    if (empty) add(id, step, label, warn.emptyFixed);
  };
  const unanswered = (empty: boolean, id: string, step: StepId, label: string) => {
    if (empty) add(id, step, label, warn.notAnswered);
  };
  emptyText(tenant.daytimePhone, 'tenant.daytimePhone', 'aboutYou', labels.tenant.daytimePhone);
  emptyText(landlord.street, 'landlord.street', 'landlord', labels.landlord.street);
  emptyText(landlord.city, 'landlord.city', 'landlord', labels.landlord.city);
  emptyFixed(blank(landlord.state), 'landlord.state', 'landlord', labels.landlord.state);
  emptyFixed(blank(landlord.zip), 'landlord.zip', 'landlord', labels.landlord.zip);
  emptyText(
    landlord.daytimePhone,
    'landlord.daytimePhone',
    'landlord',
    labels.landlord.daytimePhone,
  );
  emptyFixed(blank(rental.state), 'rental.state', 'rental', labels.rental.state);
  unanswered(!rental.typeOfRental, 'rental.typeOfRental', 'rental', labels.rental.typeOfRental);
  unanswered(
    !rental.terms.lease && !rental.terms.monthToMonth,
    'rental.terms',
    'rental',
    labels.rental.terms,
  );
  emptyFixed(!rental.moveInDate, 'rental.moveInDate', 'rental', labels.rental.moveInDate);
  // Boxes 2–4 are for current tenants, who have no move-out date yet: only
  // note an empty one when box 1 is checked or no type is chosen yet.
  const onlyCurrentTenantTypes =
    !types.formerTenantDepositNotReturned && Object.values(types).some(Boolean);
  emptyFixed(
    !rental.moveOutDate && !onlyCurrentTenantTypes,
    'rental.moveOutDate',
    'rental',
    labels.rental.moveOutDate,
  );
  for (const key of ['monthlyRentCents', 'securityDepositCents', 'otherDepositCents'] as const) {
    emptyFixed(rental[key] === null, `rental.${key}`, 'money', labels.rental[key]);
  }
  emptyFixed(
    !rental.lastRentPaidDate,
    'rental.lastRentPaidDate',
    'money',
    labels.rental.lastRentPaidDate,
  );

  // Dates.
  if (rental.moveInDate && rental.moveOutDate && rental.moveOutDate < rental.moveInDate) {
    add('rental.moveOutDate', 'rental', labels.rental.moveOutDate, warn.moveOutBeforeMoveIn, true);
  }
  const future = (date: ISODate, id: string, step: StepId, label: string) => {
    if (date && date > inputs.today) add(id, step, label, warn.futureDate, true);
  };
  future(rental.moveInDate, 'rental.moveInDate', 'rental', labels.rental.moveInDate);
  future(rental.moveOutDate, 'rental.moveOutDate', 'rental', labels.rental.moveOutDate);
  future(
    rental.lastRentPaidDate,
    'rental.lastRentPaidDate',
    'money',
    labels.rental.lastRentPaidDate,
  );

  // Money step questions and their follow-ups.
  const dr = qs.depositReturned;
  unanswered(!dr.answer, 'questions.depositReturned', 'money', q.depositReturned);
  if (dr.answer === 'yes') {
    if (dr.amountCents === null) {
      add('questions.depositReturned.amountCents', 'money', q.depositReturned, warn.followUpEmpty);
    }
    unanswered(!dr.checkCashed, 'questions.depositReturned.checkCashed', 'money', q.checkCashed);
  }
  const ip = qs.interestPaid;
  unanswered(!ip.answer, 'questions.interestPaid', 'money', q.interestPaid);
  if (ip.answer === 'yes') {
    const filled = ip.payments.filter((p) => p.date || p.amountCents !== null);
    if (filled.length === 0) {
      add('questions.interestPaid.payments', 'money', q.interestPaid, warn.followUpEmpty);
    }
    ip.payments.forEach((p, i) => {
      future(p.date, `questions.interestPaid.payments.${i}.date`, 'money', q.interestPaid);
    });
  }

  // More questions.
  unanswered(!qs.cashForKeys.answer, 'questions.cashForKeys', 'moreQuestions', q.cashForKeys);
  const list = (
    answer: string | null,
    items: readonly string[],
    id: 'roommates' | 'landlordOtherProperties',
    field: string,
  ) => {
    unanswered(!answer, `questions.${id}`, 'moreQuestions', q[id]);
    if (answer === 'yes' && items.every(blank)) {
      add(`questions.${id}.${field}`, 'moreQuestions', q[id], warn.followUpEmpty);
    }
  };
  list(qs.roommates.answer, qs.roommates.names, 'roommates', 'names');
  list(
    qs.landlordOtherProperties.answer,
    qs.landlordOtherProperties.addresses,
    'landlordOtherProperties',
    'addresses',
  );
  unanswered(
    !qs.correspondenceReceived.answer,
    'questions.correspondenceReceived',
    'moreQuestions',
    q.correspondenceReceived,
  );
  unanswered(!qs.courtAction.answer, 'questions.courtAction', 'moreQuestions', q.courtAction);
  if (qs.courtAction.answer === 'yes' && blank(qs.courtAction.docketNumber)) {
    add('questions.courtAction.docketNumber', 'moreQuestions', q.courtAction, warn.followUpEmpty);
  }

  // Characters the form can't print (§8.2).
  for (const u of inputs.unsupportedChars) {
    add(`chars.${u.path}`, stepOfPath(u.path), u.label, unprintableMessage(u.chars));
  }

  // Evidence slots with no files (never blocks Send, §8.4).
  for (const slot of deriveSlots(state)) {
    if (slot.warnIfEmpty && !inputs.slotFileCounts[slot.id]) {
      add(`slot.${slot.id}`, 'documents', slot.label, warn.slotEmpty);
    }
  }

  // Signature date.
  future(state.signature.signedDate, 'signature.signedDate', 'sign', en.steps.sign.dateLabel);

  // Packet size (§8.5).
  if (inputs.packetBytes != null) {
    const status = budgetStatus(inputs.packetBytes);
    if (status !== 'ok') {
      const size = (inputs.packetBytes / (1024 * 1024)).toFixed(1);
      add(
        'budget',
        'review',
        null,
        t(status === 'over' ? warn.budgetOver : warn.budgetWarn, { size }),
      );
    }
  }

  return issues;
}

/** Inline messages for one field or rule. */
export function inlineMessages(issues: readonly Issue[], id: string): string[] {
  return issues.filter((i) => i.inline && i.id === id).map((i) => i.message);
}
