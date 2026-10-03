// Field values as they go on the form, and the per-field character check
// (CLAUDE.md §8.2). No pdf-lib here: the wizard uses this as the user types,
// and fill.ts uses the same code path when it builds the PDF.

import { formatDateMMDDYY } from '../../core/format/date.ts';
import { formatCents } from '../../core/format/money.ts';
import { formatPhone } from '../../core/format/phone.ts';
import { type Charset, sanitize } from '../../core/pdf/text.ts';
import en from '../../i18n/en.json' with { type: 'json' };
import { TEXT_FIELDS, type TextFieldEntry, type TextPath } from './field-map.ts';
import type { DepositComplaintState, YesNo } from './schema.ts';
import { typedSignatureText } from './signature.ts';

export interface UnsupportedChars {
  /** A text field, or the typed signature. */
  path: TextPath | 'signature';
  /** The form's label for the field, for the Review warning. */
  label: string;
  chars: string[];
}

const joinList = (items: readonly string[]) =>
  items
    .map((item) => item.trim())
    .filter(Boolean)
    .join('; ');

/** The form has one street box: "12 Elm St, Apt 4B". */
const joinStreet = (street: string, line2: string) =>
  [street, line2]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');

const ifYes = (answer: YesNo, value: () => string) => (answer === 'yes' ? value() : '');

/** The text for a field exactly as it goes on the form ("" when not rendered). */
export function textValue(path: TextPath, state: DepositComplaintState): string {
  const { questions: qs, rental } = state;
  switch (path) {
    case 'tenant.street':
    case 'landlord.street': {
      const who = state[path === 'tenant.street' ? 'tenant' : 'landlord'];
      return joinStreet(who.street, who.streetLine2);
    }
    case 'rental.unitStreet':
      return joinStreet(rental.unitStreet, rental.streetLine2);
    case 'tenant.daytimePhone':
      return formatPhone(state.tenant.daytimePhone);
    case 'landlord.daytimePhone':
      return formatPhone(state.landlord.daytimePhone);
    case 'rental.moveInDate':
    case 'rental.moveOutDate':
    case 'rental.lastRentPaidDate':
      return formatDateMMDDYY(rental[path.slice('rental.'.length) as 'moveInDate']);
    case 'rental.otherDepositCents':
      // "No other deposit" is the user's own answer (§2.2): the form shows $0.00.
      // A typed amount is kept in state but not rendered (§6.2).
      if (state.gates.otherDepositPaid === 'no') return formatCents(0);
      return formatCents(rental.otherDepositCents);
    case 'rental.monthlyRentCents':
    case 'rental.securityDepositCents':
      return formatCents(rental[path.slice('rental.'.length) as 'monthlyRentCents']);
    case 'questions.interestPaid.payments':
      return ifYes(qs.interestPaid.answer, () =>
        joinList(
          qs.interestPaid.payments.map(({ date, amountCents }) =>
            [formatDateMMDDYY(date), formatCents(amountCents)].filter(Boolean).join(' – '),
          ),
        ),
      );
    case 'questions.depositReturned.amountCents':
      return ifYes(qs.depositReturned.answer, () => formatCents(qs.depositReturned.amountCents));
    case 'questions.courtAction.docketNumber':
      return ifYes(qs.courtAction.answer, () => qs.courtAction.docketNumber.trim());
    case 'questions.roommates.names':
      return ifYes(qs.roommates.answer, () => joinList(qs.roommates.names));
    case 'questions.landlordOtherProperties.addresses':
      return ifYes(qs.landlordOtherProperties.answer, () =>
        joinList(qs.landlordOtherProperties.addresses),
      );
    case 'additionalComments':
      return state.additionalComments.trim();
    default: {
      const [group, key] = path.split('.') as ['tenant' | 'landlord' | 'rental', string];
      const value = (state[group] as unknown as Record<string, unknown>)[key];
      return typeof value === 'string' ? value.trim() : '';
    }
  }
}

export interface SanitizedField {
  entry: TextFieldEntry;
  /** Sanitized text; newlines kept (single-line fields flatten them when filling). */
  text: string;
  /** Characters the font can't encode, printed as "?". */
  replaced: string[];
}

/** Every non-empty text field, sanitized for the PDF font. Hidden follow-ups (§6.2) are left out. */
export function sanitizedTextFields(
  state: DepositComplaintState,
  charset: Charset,
): SanitizedField[] {
  const out: SanitizedField[] = [];
  for (const entry of TEXT_FIELDS) {
    const raw = textValue(entry.path, state);
    if (!raw) continue;
    const { text, replaced } = sanitize(raw, charset);
    out.push({ entry, text, replaced });
  }
  return out;
}

/** Characters that would print as "?", per field (§8.2): the inline warning and Review. */
export function collectUnsupportedChars(
  state: DepositComplaintState,
  charset: Charset,
): UnsupportedChars[] {
  const out = unsupportedOf(sanitizedTextFields(state, charset));
  const signature = typedSignatureChars(state, charset);
  if (signature) out.push(signature);
  return out;
}

/** The typed signature prints in Helvetica Oblique, which has the same charset (§14). */
export function typedSignatureChars(
  state: DepositComplaintState,
  charset: Charset,
): UnsupportedChars | null {
  const { method, typedName } = state.signature;
  if (method !== 'typed' || !typedName.trim()) return null;
  const { replaced } = sanitize(typedSignatureText(typedName), charset);
  return replaced.length
    ? { path: 'signature', label: en.steps.sign.signatureLabel, chars: replaced }
    : null;
}

export function unsupportedOf(fields: readonly SanitizedField[]): UnsupportedChars[] {
  return fields
    .filter((f) => f.replaced.length > 0)
    .map((f) => ({ path: f.entry.path, label: f.entry.label, chars: f.replaced }));
}
