// Turns a picked file into an UploadedFile (CLAUDE.md §8.5): images are
// compressed immediately and the original dropped; PDFs are checked (locked,
// unreadable) and their pages counted. pdf-lib is loaded only when a PDF is added.

import { createObjectUrl } from '../blob-urls.ts';
import { compressImage } from '../images/compress.ts';
import { ImageDecodeError } from '../images/errors.ts';
import type { ImagePreset } from '../images/presets.ts';
import { PdfLockedError } from '../pdf/errors.ts';
import type { UploadedFile } from './store.ts';

/** Handled failures; `pdf_encrypted` etc. match the §19.4 known-issue codes. */
export type IngestError =
  | 'image_decode_failed'
  | 'pdf_encrypted'
  | 'pdf_unreadable'
  | 'unsupported_type';

export type IngestResult =
  | { ok: true; file: UploadedFile }
  | { ok: false; error: IngestError; name: string };

const IMAGE_EXTENSION = /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp)$/i;

export function fileKind(file: { type: string; name: string }): 'image' | 'pdf' | null {
  if (file.type === 'application/pdf' || (!file.type && /\.pdf$/i.test(file.name))) return 'pdf';
  if (file.type.startsWith('image/') || (!file.type && IMAGE_EXTENSION.test(file.name))) {
    return 'image';
  }
  return null;
}

export async function ingestFile(file: File, preset: ImagePreset): Promise<IngestResult> {
  const kind = fileKind(file);
  const fail = (error: IngestError): IngestResult => ({ ok: false, error, name: file.name });
  if (kind === 'image') {
    try {
      return { ok: true, file: await imageFile(file, file.name, preset) };
    } catch (error) {
      // Telemetry (Phase 6): known_issue image_decode_failed, or operation_failed compress_image.
      if (error instanceof ImageDecodeError) return fail('image_decode_failed');
      throw error;
    }
  }
  if (kind === 'pdf') {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { loadUploadedPdf } = await import('../pdf/pages.ts');
    try {
      const doc = await loadUploadedPdf(bytes);
      return {
        ok: true,
        file: {
          kind: 'pdf',
          id: newId(),
          name: file.name,
          pages: doc.getPageCount(),
          pdf: new Blob([bytes], { type: 'application/pdf' }),
        },
      };
    } catch (error) {
      // Telemetry (Phase 6): known_issue pdf_encrypted / pdf_unreadable.
      return fail(error instanceof PdfLockedError ? 'pdf_encrypted' : 'pdf_unreadable');
    }
  }
  return fail('unsupported_type');
}

/** Compresses an image (or re-compresses an image already in the store). */
export async function imageFile(
  source: Blob,
  name: string,
  preset: ImagePreset,
  id: string = newId(),
): Promise<UploadedFile> {
  const { color, gray } = await compressImage(source, preset);
  return {
    kind: 'image',
    id,
    name,
    pages: 1,
    color,
    gray,
    thumbUrl: createObjectUrl(color),
    preset: preset.id,
  };
}

const newId = () => crypto.randomUUID();
