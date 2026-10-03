// Builds the complaint packet (CLAUDE.md §8): unsigned preview for Review,
// signed final for Send.

import { StandardFonts } from 'pdf-lib';
import { formatDateMMDDYY } from '../../core/format/date.ts';
import {
  type AssembleResult,
  type AttachmentGroup,
  assemblePacket,
  type FillContext,
  type PdfAssets,
} from '../../core/pdf/assemble.ts';
import type { AttachmentFile } from '../../core/pdf/pages.ts';
import { sanitize } from '../../core/pdf/text.ts';
import en from '../../i18n/en.json' with { type: 'json' };
import { t } from '../../i18n/t.ts';
import { deriveSlots, type SlotId } from './checklist.ts';
import { isDisclaimerAccepted } from './disclaimer.ts';
import { SIGNATURE_BOX, SIGNED_DATE } from './field-map.ts';
import { fillForm } from './fill.ts';
import type { DepositComplaintState } from './schema.ts';
import { hasSignature, typedSignatureText } from './signature.ts';
import type { UnsupportedChars } from './values.ts';

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

export async function buildComplaintPacket(
  state: DepositComplaintState,
  files: SlotFiles,
  { mode, assets, flatten }: BuildOptions,
): Promise<ComplaintPacket> {
  // §7 step 10: no PDF is built until the current disclaimer is accepted.
  if (!isDisclaimerAccepted(state)) throw new DisclaimerNotAcceptedError('Disclaimer not accepted');
  // The final packet carries the signature: drawn (PNG) or typed (§14).
  const signing = mode === 'final';
  const { signature } = state;
  const signaturePng =
    signing && signature.method === 'drawn' ? decodePngDataUrl(signature.pngDataUrl) : null;
  if (signing && (!hasSignature(signature) || (signature.method === 'drawn' && !signaturePng))) {
    throw new SignatureMissingError('Signature missing');
  }

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
      unsupportedChars = [...filled.unsupportedChars];
      if (signing) {
        if (signaturePng) await drawSignatureImage(ctx, signaturePng);
        else {
          const replaced = await drawTypedSignature(ctx, signature.typedName);
          if (replaced.length) {
            unsupportedChars.push({
              path: 'signature',
              label: en.steps.sign.signatureLabel,
              chars: replaced,
            });
          }
        }
        const date = formatDateMMDDYY(signature.signedDate);
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
      t(en.pdf.exhibitHeader, {
        tenantName: displayName,
        number,
        total,
        label,
        page,
        pages,
      }),
    attachments,
  });

  if (unsupportedChars.length > 0 && import.meta.env?.DEV) {
    const chars = [...new Set(unsupportedChars.flatMap((u) => u.chars))];
    console.warn(`Replaced characters the PDF font can't encode: ${chars.join(' ')}`);
  }
  return { ...result, unsupportedChars };
}

/** The drawn signature, scaled to fit above the line, bottom-left aligned (§5.2). */
async function drawSignatureImage(ctx: FillContext, png: Uint8Array) {
  const page = ctx.doc.getPage(SIGNATURE_BOX.pageIndex);
  const image = await ctx.doc.embedPng(png);
  const maxHeight = SIGNATURE_BOX.top - SIGNATURE_BOX.bottom;
  const scale = Math.min(SIGNATURE_BOX.maxWidth / image.width, maxHeight / image.height);
  page.drawImage(image, {
    x: SIGNATURE_BOX.x,
    y: SIGNATURE_BOX.bottom,
    width: image.width * scale,
    height: image.height * scale,
  });
}

const TYPED_MAX_SIZE = 12;
const TYPED_MIN_SIZE = 7;

/**
 * "/s/ {name}" in Helvetica Oblique on the signature line (§14), next to the
 * date. A standard font, so nothing is embedded. Shrinks to fit; a name too long
 * even at 7pt is cut at the box edge. Returns the characters printed as "?".
 */
async function drawTypedSignature(ctx: FillContext, name: string): Promise<string[]> {
  const font = await ctx.doc.embedFont(StandardFonts.HelveticaOblique);
  const { text: sanitized, replaced } = sanitize(typedSignatureText(name), ctx.charset);
  let text = sanitized.replace(/\s+/g, ' ');
  let size = TYPED_MAX_SIZE;
  while (size > TYPED_MIN_SIZE && font.widthOfTextAtSize(text, size) > SIGNATURE_BOX.maxWidth) {
    size -= 0.5;
  }
  while (text.length > 0 && font.widthOfTextAtSize(text, size) > SIGNATURE_BOX.maxWidth) {
    text = text.slice(0, -1);
  }
  ctx.doc.getPage(SIGNATURE_BOX.pageIndex).drawText(text, {
    x: SIGNATURE_BOX.x,
    y: SIGNED_DATE.baseline,
    size,
    font,
  });
  return replaced;
}

function decodePngDataUrl(dataUrl: string | null): Uint8Array | null {
  const match = dataUrl ? /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null;
  if (!match?.[1]) return null;
  const binary = atob(match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Kept with the email text (no pdf-lib), so Send can name the file without
// loading pdf-lib into the main bundle.
export { packetFilename } from './send.ts';
