// Validation (CLAUDE.md §6.3). Hard requirements block Send. Moving between
// pages needs only the page's own answer or "Skip for now" (§7). Soft warnings never block and are phrased as observations, never
// as advice about which answer is right (§2.2).

import { budgetStatus } from '../../core/pdf/budget.ts';
import en from '../../i18n/en.json' with { type: 'json' };
import { t } from '../../i18n/t.ts';
import { deriveSlots, type SlotId } from './checklist.ts';
import { isDisclaimerAccepted } from './disclaimer.ts';
import type { TextPath } from './field-map.ts';
import type { DepositComplaintState, ISODate } from './schema.ts';
import { hasSignature } from './signature.ts';
import type { StepId } from './steps/ids.ts';
import { pageOfPath } from './steps/pages.ts';
import { textValue, type UnsupportedChars } from './values.ts';
import verbatim from './verbatim.json' with { type: 'json' };

export interface Issue {
  /** Stable key: a schema path ("tenant.name"), "slot.<id>", "chars.<path>", or a rule name. */
  id: string;
  /** The page to fix it on (Edit links). */
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
    'situation.movedOut',
    req.complaintType,
  );
  const { tenant, landlord, rental } = state;
  const text = (path: TextPath, value: string, label: string) =>
    need(blank(value), path, pageOfPath(path), label);
  text('tenant.name', tenant.name, labels.tenant.name);
  text('tenant.street', tenant.street, labels.tenant.street);
  text('tenant.city', tenant.city, labels.tenant.city);
  text('tenant.state', tenant.state, labels.tenant.state);
  text('tenant.zip', tenant.zip, labels.tenant.zip);
  text('landlord.name', landlord.name, labels.landlord.name);
  text('rental.unitStreet', rental.unitStreet, labels.rental.unitStreet);
  text('rental.city', rental.city, labels.rental.city);
  text('rental.zip', rental.zip, labels.rental.zip);
  need(!isDisclaimerAccepted(state), 'disclaimer', 'disclaimer', req.disclaimer);
  need(!state.signature.statementsRead, 'statementsRead', 'sign.statements', req.statementsRead);
  need(!hasSignature(state.signature), 'signature', 'sign.signature', req.signature);
  return issues;
}

export function canSend(state: DepositComplaintState): boolean {
  return missingRequired(state).length === 0;
}

export interface WarningInputs {
  /** From collectUnsupportedChars(state, WIN_ANSI). */
  unsupportedChars: readonly UnsupportedChars[];
  /** Files added per derived evidence slot (slotFileCounts in uploads.ts). */
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

/** §6.3 soft warnings. Review groups them by chapter. */
export function softWarnings(state: DepositComplaintState, inputs: WarningInputs): Issue[] {
  const issues: Issue[] = [];
  const add = (id: string, step: StepId, label: string | null, message: string, inline = false) =>
    issues.push({ id, step, label, message, ...(inline ? { inline: true as const } : {}) });
  const { rental, questions: qs } = state;

  // Empty fields the form asks for (hard-required ones are listed separately).
  // Fixed-format fields (State, Zip, dates, money, choices) can't hold "Unknown".
  // Each warning links to the page that asks for the field.
  const emptyText = (path: TextPath, label: string) => {
    if (textValue(path, state) === '') add(path, pageOfPath(path), label, warn.empty);
  };
  const emptyFixed = (path: TextPath, label: string, when = true) => {
    if (when && textValue(path, state) === '') add(path, pageOfPath(path), label, warn.emptyFixed);
  };
  const unanswered = (empty: boolean, id: string, step: StepId, label: string) => {
    if (empty) add(id, step, label, warn.notAnswered);
  };
  const followUp = (empty: boolean, id: TextPath, label: string) => {
    if (empty) add(id, pageOfPath(id), label, warn.followUpEmpty);
  };
  emptyText('tenant.daytimePhone', labels.tenant.daytimePhone);
  emptyText('landlord.street', labels.landlord.street);
  emptyText('landlord.city', labels.landlord.city);
  emptyFixed('landlord.state', labels.landlord.state);
  emptyFixed('landlord.zip', labels.landlord.zip);
  emptyText('landlord.daytimePhone', labels.landlord.daytimePhone);
  emptyFixed('rental.state', labels.rental.state);
  unanswered(
    !rental.typeOfRental,
    'rental.typeOfRental',
    pageOfPath('typeOfRental'),
    labels.rental.typeOfRental,
  );
  unanswered(
    !rental.terms.lease && !rental.terms.monthToMonth,
    'rental.terms',
    pageOfPath('terms.lease'),
    labels.rental.terms,
  );
  emptyFixed('rental.moveInDate', labels.rental.moveInDate);
  // Current tenants have no move-out date yet; the Move Out page is skipped for them.
  emptyFixed('rental.moveOutDate', labels.rental.moveOutDate, state.gates.movedOut !== 'no');
  emptyFixed('rental.lastRentPaidDate', labels.rental.lastRentPaidDate);
  // Other deposit answered "No" shows $0.00, so it isn't empty.
  for (const key of ['monthlyRentCents', 'securityDepositCents', 'otherDepositCents'] as const) {
    emptyFixed(`rental.${key}`, labels.rental[key]);
  }

  // Dates.
  if (rental.moveInDate && rental.moveOutDate && rental.moveOutDate < rental.moveInDate) {
    add(
      'rental.moveOutDate',
      pageOfPath('rental.moveOutDate'),
      labels.rental.moveOutDate,
      warn.moveOutBeforeMoveIn,
      true,
    );
  }
  const future = (date: ISODate, id: string, step: StepId, label: string) => {
    if (date && date > inputs.today) add(id, step, label, warn.futureDate, true);
  };
  for (const key of ['moveInDate', 'moveOutDate', 'lastRentPaidDate'] as const) {
    const path = `rental.${key}` as const;
    future(rental[key], path, pageOfPath(path), labels.rental[key]);
  }

  // The form's YES/NO questions and their follow-ups.
  const dr = qs.depositReturned;
  unanswered(
    !dr.answer,
    'questions.depositReturned',
    pageOfPath('yesNo.depositReturned'),
    q.depositReturned,
  );
  if (dr.answer === 'yes') {
    followUp(dr.amountCents === null, 'questions.depositReturned.amountCents', q.depositReturned);
    unanswered(
      !dr.checkCashed,
      'questions.depositReturned.checkCashed',
      pageOfPath('yesNo.checkCashed'),
      q.checkCashed,
    );
  }
  const ip = qs.interestPaid;
  unanswered(
    !ip.answer,
    'questions.interestPaid',
    pageOfPath('yesNo.interestPaid'),
    q.interestPaid,
  );
  if (ip.answer === 'yes') {
    const payments = pageOfPath('questions.interestPaid.payments');
    followUp(
      ip.payments.every((p) => !p.date && p.amountCents === null),
      'questions.interestPaid.payments',
      q.interestPaid,
    );
    ip.payments.forEach((p, i) => {
      future(p.date, `questions.interestPaid.payments.${i}.date`, payments, q.interestPaid);
    });
  }
  unanswered(
    !qs.cashForKeys.answer,
    'questions.cashForKeys',
    pageOfPath('cashForKeys'),
    q.cashForKeys,
  );
  unanswered(
    !qs.roommates.answer,
    'questions.roommates',
    pageOfPath('yesNo.roommates'),
    q.roommates,
  );
  if (qs.roommates.answer === 'yes') {
    followUp(qs.roommates.names.every(blank), 'questions.roommates.names', q.roommates);
  }
  const op = qs.landlordOtherProperties;
  unanswered(
    !op.answer,
    'questions.landlordOtherProperties',
    pageOfPath('yesNo.landlordOtherProperties'),
    q.landlordOtherProperties,
  );
  if (op.answer === 'yes') {
    followUp(
      op.addresses.every(blank),
      'questions.landlordOtherProperties.addresses',
      q.landlordOtherProperties,
    );
  }
  unanswered(
    !qs.correspondenceReceived.answer,
    'questions.correspondenceReceived',
    pageOfPath('yesNo.correspondenceReceived'),
    q.correspondenceReceived,
  );
  unanswered(
    !qs.courtAction.answer,
    'questions.courtAction',
    pageOfPath('yesNo.courtAction'),
    q.courtAction,
  );
  if (qs.courtAction.answer === 'yes') {
    followUp(
      blank(qs.courtAction.docketNumber),
      'questions.courtAction.docketNumber',
      q.courtAction,
    );
  }

  // Characters the form can't print (§8.2).
  for (const u of inputs.unsupportedChars) {
    add(`chars.${u.path}`, pageOfPath(u.path), u.label, unprintableMessage(u.chars));
  }

  // Evidence slots with no files (never blocks Send, §8.4).
  for (const slot of deriveSlots(state)) {
    if (slot.warnIfEmpty && !inputs.slotFileCounts[slot.id]) {
      add(`slot.${slot.id}`, `documents.${slot.id}`, slot.label, warn.slotEmpty);
    }
  }

  // Signature date.
  future(
    state.signature.signedDate,
    'signature.signedDate',
    'sign.signature',
    en.steps.sign.dateLabel,
  );

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
