// Fills the form's AcroForm fields from state (CLAUDE.md §8.2, §8.3, §6.2).

import {
  setButtonState,
  setCheckbox,
  setExclusive,
  setText,
  textFieldBox,
} from '../../core/pdf/acroform.ts';
import type { FillContext, FillResult } from '../../core/pdf/assemble.ts';
import type { ContinuationSection } from '../../core/pdf/pages.ts';
import { fitText, toSingleLine } from '../../core/pdf/text.ts';
import en from '../../i18n/en.json' with { type: 'json' };
import {
  CASH_FOR_KEYS_FIELDS,
  COMPLAINT_TYPE_FIELDS,
  TERMS_FIELDS,
  type TextFieldEntry,
  TYPE_OF_RENTAL,
  YES_NO_FIELDS,
  YES_NO_ON_VALUES,
  type YesNoQuestion,
} from './fieldMap.ts';
import { COMPLAINT_TYPES, type DepositComplaintState, type YesNo } from './schema.ts';
import { sanitizedTextFields, type UnsupportedChars, unsupportedOf } from './values.ts';

export interface FormFillResult extends FillResult {
  unsupportedChars: UnsupportedChars[];
}

function continuationHeading(entry: TextFieldEntry): string {
  return entry.group ? `${en.pdf.continuationGroups[entry.group]}: ${entry.label}` : entry.label;
}

/**
 * Placeholder for an overflowed field. The full phrase doesn't fit narrow
 * fields (State, Zip), so fall back to "See p. N".
 */
function placeholderFits(
  ctx: FillContext,
  box: { width: number; height: number },
  continuationPage: number,
) {
  for (const text of [
    en.pdf.seeContinuation,
    en.pdf.seeContinuationShort.replace('{page}', String(continuationPage)),
  ]) {
    const fit = fitText(text, ctx.fonts.regular, box, { multiline: false });
    if (fit) return { text, size: fit.size };
  }
  return { text: en.pdf.seeContinuationShort.replace('{page}', String(continuationPage)), size: 7 };
}

export function fillForm(ctx: FillContext, state: DepositComplaintState): FormFillResult {
  const { form } = ctx;
  const continuation: ContinuationSection[] = [];
  const continuationPage = ctx.doc.getPageCount() + 1;

  // Text fields.
  const fields = sanitizedTextFields(state, ctx.charset);
  for (const { entry, text: clean } of fields) {
    const text = entry.multiline ? clean : toSingleLine(clean);
    const box = textFieldBox(form, entry.field);
    const fit = fitText(text, ctx.fonts.regular, box, { multiline: entry.multiline === true });
    if (fit) {
      setText(form, entry.field, fit.lines.join('\n'), fit.size);
    } else {
      const placeholder = placeholderFits(ctx, box, continuationPage);
      setText(form, entry.field, placeholder.text, placeholder.size);
      continuation.push({ heading: continuationHeading(entry), body: clean });
    }
  }

  // Complaint types (page 2).
  for (const type of COMPLAINT_TYPES) {
    setCheckbox(form, COMPLAINT_TYPE_FIELDS[type], state.complaintTypes[type]);
  }

  // Type and terms of rental.
  const rentalType = state.rental.typeOfRental;
  setButtonState(
    form,
    TYPE_OF_RENTAL.field,
    rentalType ? TYPE_OF_RENTAL.onValues[rentalType] : null,
  );
  setCheckbox(form, TERMS_FIELDS.lease, state.rental.terms.lease);
  setCheckbox(form, TERMS_FIELDS.monthToMonth, state.rental.terms.monthToMonth);

  // YES/NO questions. "Check cashed" is a follow-up of "deposit returned" (§6.2).
  const qs = state.questions;
  const answers: Record<YesNoQuestion, YesNo> = {
    interestPaid: qs.interestPaid.answer,
    correspondenceReceived: qs.correspondenceReceived.answer,
    depositReturned: qs.depositReturned.answer,
    checkCashed: qs.depositReturned.answer === 'yes' ? qs.depositReturned.checkCashed : null,
    courtAction: qs.courtAction.answer,
    roommates: qs.roommates.answer,
    landlordOtherProperties: qs.landlordOtherProperties.answer,
  };
  for (const [question, field] of Object.entries(YES_NO_FIELDS) as [YesNoQuestion, string][]) {
    const answer = answers[question];
    setButtonState(form, field, answer ? YES_NO_ON_VALUES[answer] : null);
  }

  // Cash for Keys: three independent boxes, exactly one checked.
  const cfk = qs.cashForKeys.answer;
  setExclusive(form, Object.values(CASH_FOR_KEYS_FIELDS), cfk ? CASH_FOR_KEYS_FIELDS[cfk] : null);

  return { continuation, unsupportedChars: unsupportedOf(fields) };
}
