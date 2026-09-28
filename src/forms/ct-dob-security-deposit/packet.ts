// Builds the complaint packet (CLAUDE.md §8): unsigned preview for Review,
// signed final for Send.

import { formatDateMMDDYY, todayIso } from '../../core/format/date.ts';
import {
  type AssembleResult,
  type AttachmentGroup,
  assemblePacket,
  type PdfAssets,
} from '../../core/pdf/assemble.ts';
import type { AttachmentFile } from '../../core/pdf/pages.ts';
import { sanitize } from '../../core/pdf/text.ts';
import en from '../../i18n/en.json' with { type: 'json' };
import { deriveSlots, type SlotId } from './checklist.ts';
import { DISCLAIMER_VERSION } from './config.ts';
import { SIGNATURE_BOX, SIGNED_DATE } from './fieldMap.ts';
import { fillForm, type UnsupportedChars } from './fill.ts';
import type { DepositComplaintState } from './schema.ts';

export class DisclaimerNotAcceptedError extends Error {
  override name = 'DisclaimerNotAcceptedError';
}

export class SignatureMissingError extends Error {
  override name = 'SignatureMissingError';
}

export type PacketMode = 'preview' | 'final';

/** Uploaded files by slot. Files in slots the current answers don't derive are left out. */
export type SlotFiles = Partial<Record<SlotId, AttachmentFile[]>>;

export interface BuildOptions {
  mode: PacketMode;
  assets: PdfAssets;
  /** Tests only: skip flattening so field values can be read back. */
  flatten?: boolean;
}

export interface ComplaintPacket extends AssembleResult {
  /** Characters that print as "?" because the PDF font can't encode them, per field. */
  unsupportedChars: UnsupportedChars[];
}

export function isDisclaimerAccepted(state: DepositComplaintState): boolean {
  return (
    state.meta.disclaimerVersion === DISCLAIMER_VERSION && Boolean(state.meta.disclaimerAcceptedAt)
  );
}

export async function buildComplaintPacket(
  state: DepositComplaintState,
  files: SlotFiles,
  { mode, assets, flatten }: BuildOptions,
): Promise<ComplaintPacket> {
  // §7 step 10: no PDF is built until the current disclaimer is accepted.
  if (!isDisclaimerAccepted(state)) throw new DisclaimerNotAcceptedError('Disclaimer not accepted');
  const signaturePng = mode === 'final' ? decodePngDataUrl(state.signature.pngDataUrl) : null;
  if (mode === 'final' && !signaturePng) throw new SignatureMissingError('Signature missing');

  let unsupportedChars: UnsupportedChars[] = [];
  const tenantName = (charset: Parameters<typeof sanitize>[1]) =>
    sanitize(state.tenant.name.trim(), charset).text.replace(/\s*\n\s*/g, ' ');
  // Set during fill, once the font is loaded; used on the added pages.
  let displayName = '';

  const attachments: AttachmentGroup[] = deriveSlots(state).map((slot) => ({
    label: slot.label,
    files: files[slot.id] ?? [],
  }));

  const result = await assemblePacket({
    assets,
    flatten,
    previewLabel: mode === 'preview' ? en.pdf.previewLabel : null,
    documentTitle: en.pdf.documentTitle,
    async fill(ctx) {
      displayName = tenantName(ctx.charset);
      const filled = fillForm(ctx, state);
      unsupportedChars = filled.unsupportedChars;
      if (signaturePng) {
        const page = ctx.doc.getPage(SIGNATURE_BOX.pageIndex);
        const image = await ctx.doc.embedPng(signaturePng);
        const maxHeight = SIGNATURE_BOX.top - SIGNATURE_BOX.bottom;
        const scale = Math.min(SIGNATURE_BOX.maxWidth / image.width, maxHeight / image.height);
        page.drawImage(image, {
          x: SIGNATURE_BOX.x,
          y: SIGNATURE_BOX.bottom,
          width: image.width * scale,
          height: image.height * scale,
        });
        const date = formatDateMMDDYY(state.signature.signedDate);
        if (date) {
          ctx.doc.getPage(SIGNED_DATE.pageIndex).drawText(date, {
            x: SIGNED_DATE.x,
            y: SIGNED_DATE.baseline,
            size: SIGNED_DATE.size,
            font: ctx.fonts.regular,
          });
        }
      }
      return filled;
    },
    subtitle: () => displayName,
    continuationTitle: en.pdf.continuationTitle,
    index: { title: en.pdf.indexTitle, columns: en.pdf.indexColumns, empty: en.pdf.indexEmpty },
    exhibitHeader: ({ number, total, label, page, pages }) =>
      fillTemplate(en.pdf.exhibitHeader, {
        tenantName: displayName,
        number,
        total,
        label,
        page,
        pages,
      }),
    attachments,
  });

  return { ...result, unsupportedChars };
}

function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

function decodePngDataUrl(dataUrl: string | null): Uint8Array | null {
  const match = dataUrl ? /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null;
  if (!match?.[1]) return null;
  const binary = atob(match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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
