// Packet assembly (CLAUDE.md §8.1): filled + flattened form, continuation
// page(s), attachment index, exhibits. Form-agnostic: the form module supplies
// the fill step and all strings.

import { PDFDocument, type PDFForm, StandardFonts } from 'pdf-lib';
import {
  type AttachmentFile,
  addContinuationPages,
  addExhibitPage,
  addIndexPages,
  addPreviewHeader,
  type ContinuationSection,
  type ExhibitItem,
  type Fonts,
  type IndexRow,
  type IndexStrings,
  prepareExhibit,
} from './pages.ts';
import { type Charset, charsetOf } from './text.ts';

/** Bytes the builder needs. Loaded as a module by the caller, never fetched (§8). */
export interface PdfAssets {
  template: Uint8Array;
}

export interface FillContext {
  doc: PDFDocument;
  form: PDFForm;
  fonts: Fonts;
  /** What the font can encode (WinAnsi); pass to sanitize(). */
  charset: Charset;
}

export interface FillResult {
  continuation: ContinuationSection[];
}

export interface AttachmentGroup {
  label: string;
  files: AttachmentFile[];
}

export interface ExhibitHeaderInfo {
  number: number;
  total: number;
  label: string;
  page: number;
  pages: number;
}

export interface AssembleInput {
  assets: PdfAssets;
  fill: (ctx: FillContext) => FillResult | Promise<FillResult>;
  /** Tests read field values back before flattening; the app always flattens. */
  flatten?: boolean;
  /** Shown on every form page of an unsigned preview; null for the final packet. */
  previewLabel: string | null;
  /** Line under the continuation and index titles (e.g. the tenant's name). Called after fill. */
  subtitle: () => string;
  continuationTitle: string;
  index: Omit<IndexStrings, 'subtitle'>;
  exhibitHeader: (info: ExhibitHeaderInfo) => string;
  /** In checklist order. Groups with no files are left out. */
  attachments: AttachmentGroup[];
  documentTitle: string;
}

export interface AssembleResult {
  bytes: Uint8Array;
  pageCount: number;
  formPageCount: number;
  continuationPageCount: number;
  /** One row per non-empty attachment group, with 1-based packet page numbers. */
  attachmentRows: IndexRow[];
}

export async function assemblePacket(input: AssembleInput): Promise<AssembleResult> {
  const doc = await PDFDocument.load(input.assets.template, { updateMetadata: false });
  // pdf-lib's standard fonts (WinAnsi): nothing to bundle or embed (§3).
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const charset = charsetOf(fonts.regular);
  const form = doc.getForm();
  const formPageCount = doc.getPageCount();

  // 1. Form pages.
  const { continuation } = await input.fill({ doc, form, fonts, charset });
  form.updateFieldAppearances(fonts.regular);
  if (input.flatten !== false) form.flatten({ updateFieldAppearances: false });
  if (input.previewLabel) {
    for (const page of doc.getPages()) addPreviewHeader(page, fonts, input.previewLabel);
  }

  // 2. Continuation page(s), only if something overflowed.
  const continuationPages =
    continuation.length > 0
      ? addContinuationPages(doc, fonts, {
          title: input.continuationTitle,
          subtitle: input.subtitle(),
          sections: continuation,
        })
      : [];

  // 3. Index + 4. exhibits. Embed everything first so page ranges are known.
  const groups: { label: string; items: ExhibitItem[]; fileCount: number }[] = [];
  for (const group of input.attachments) {
    if (group.files.length === 0) continue;
    const items: ExhibitItem[] = [];
    for (const file of group.files) items.push(...(await prepareExhibit(doc, file)));
    groups.push({ label: group.label, items, fileCount: group.files.length });
  }

  const rowsFor = (indexPages: number): IndexRow[] => {
    let next = doc.getPageCount() + indexPages + 1;
    return groups.map((group, i) => {
      const firstPage = next;
      next += group.items.length;
      return {
        number: i + 1,
        label: group.label,
        fileCount: group.fileCount,
        firstPage,
        lastPage: next - 1,
      };
    });
  };
  const indexStrings: IndexStrings = { ...input.index, subtitle: input.subtitle() };
  const indexStart = doc.getPageCount();
  let rows = rowsFor(1);
  const indexPages = addIndexPages(doc, fonts, indexStrings, rows).length;
  if (indexPages !== 1) {
    for (let i = 0; i < indexPages; i++) doc.removePage(indexStart);
    rows = rowsFor(indexPages);
    addIndexPages(doc, fonts, indexStrings, rows);
  }

  groups.forEach((group, g) => {
    group.items.forEach((item, p) => {
      const header = input.exhibitHeader({
        number: g + 1,
        total: groups.length,
        label: group.label,
        page: p + 1,
        pages: group.items.length,
      });
      addExhibitPage(doc, fonts, header, item);
    });
  });

  doc.setTitle(input.documentTitle);
  const bytes = await doc.save();
  return {
    bytes,
    pageCount: doc.getPageCount(),
    formPageCount,
    continuationPageCount: continuationPages.length,
    attachmentRows: rows,
  };
}
