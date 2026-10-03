// The email's subject and body and the PDF's filename (CLAUDE.md §8.6), from
// the user's own answers. No pdf-lib here: Send imports this directly.

import { todayIso } from '../../core/format/date.ts';
import en from '../../i18n/en.json' with { type: 'json' };
import { t } from '../../i18n/t.ts';
import type { DepositComplaintState } from './schema.ts';
import { textValue } from './values.ts';

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

export function emailMessage(state: DepositComplaintState): { subject: string; body: string } {
  const name = oneLine(state.tenant.name);
  const subject = t(en.steps.send.subject, {
    name,
    address: oneLine(textValue('rental.unitStreet', state)),
  });
  const body = t(en.steps.send.body, {
    name,
    phone: oneLine(textValue('tenant.daytimePhone', state)),
  }).trimEnd();
  return { subject, body };
}

/** `CT-Security-Deposit-Complaint_{TenantLastName}_{YYYY-MM-DD}.pdf` (§8.6). */
export function packetFilename(state: DepositComplaintState, today: string = todayIso()): string {
  const lastName = state.tenant.name.trim().split(/\s+/).at(-1) ?? '';
  const safe = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9_-]/g, '');
  const parts = [en.pdf.filenamePrefix, safe(lastName), safe(today)].filter(Boolean);
  return `${parts.join('_')}.pdf`;
}
