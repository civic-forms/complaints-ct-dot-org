// Pages the app adds after the form (CLAUDE.md §8.1): continuation, attachment
// index, exhibits. All US Letter, 0.5in margins, Helvetica, black.

import {
  degrees,
  type PDFDocument,
  PDFDocument as PDFDocumentClass,
  type PDFEmbeddedPage,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  rgb,
} from 'pdf-lib';
import { PdfLockedError, PdfUnreadableError } from './errors.ts';
import { wrapLines } from './text.ts';

export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;
export const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BLACK = rgb(0, 0, 0);

export interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

/** Writes lines top-down across as many pages as needed. */
class Flow {
  page!: PDFPage;
  y = 0;
  readonly pages: PDFPage[] = [];
  private readonly doc: PDFDocument;

  constructor(doc: PDFDocument) {
    this.doc = doc;
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pages.push(this.page);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  /** Moves down by `height`, starting a new page if it doesn't fit. */
  reserve(height: number) {
    if (this.y - height < MARGIN) this.newPage();
    this.y -= height;
    return this.y;
  }

  paragraph(text: string, font: PDFFont, size: number, x = MARGIN, width = CONTENT_WIDTH) {
    const lineHeight = size * 1.35;
    for (const line of wrapLines(text, font, size, width)) {
      const y = this.reserve(lineHeight);
      if (line) this.page.drawText(line, { x, y: y + lineHeight - size, size, font, color: BLACK });
    }
  }
}

export interface ContinuationSection {
  heading: string;
  body: string;
}

/** Continuation page(s) for text that overflowed its form field (§8.3). */
export function addContinuationPages(
  doc: PDFDocument,
  fonts: Fonts,
  {
    title,
    subtitle,
    sections,
  }: { title: string; subtitle: string; sections: ContinuationSection[] },
): PDFPage[] {
  const flow = new Flow(doc);
  flow.paragraph(title, fonts.bold, 14);
  flow.paragraph(subtitle, fonts.regular, 10);
  for (const section of sections) {
    flow.reserve(10);
    flow.paragraph(section.heading, fonts.bold, 10);
    flow.reserve(2);
    flow.paragraph(section.body, fonts.regular, 10);
  }
  return flow.pages;
}

export interface IndexRow {
  number: number;
  label: string;
  fileCount: number;
  firstPage: number;
  lastPage: number;
}

export interface IndexStrings {
  title: string;
  subtitle: string;
  columns: { number: string; label: string; files: string; pages: string };
  empty: string;
}

const COLUMN_X = { number: MARGIN, label: MARGIN + 62, files: MARGIN + 450, pages: MARGIN + 490 };
const LABEL_WIDTH = COLUMN_X.files - COLUMN_X.label - 12;
const TABLE_SIZE = 9.5;
const TABLE_LINE = TABLE_SIZE * 1.35;

/**
 * Attachment index (§8.5). Page numbers don't affect the layout, so the caller
 * can draw it, and if it took more pages than assumed, remove and redraw it.
 */
export function addIndexPages(
  doc: PDFDocument,
  fonts: Fonts,
  strings: IndexStrings,
  rows: IndexRow[],
): PDFPage[] {
  const flow = new Flow(doc);
  flow.paragraph(strings.title, fonts.bold, 16);
  flow.paragraph(strings.subtitle, fonts.regular, 10);
  flow.reserve(10);
  if (rows.length === 0) {
    flow.paragraph(strings.empty, fonts.regular, 10);
    return flow.pages;
  }

  const drawHeader = () => {
    const y = flow.reserve(TABLE_LINE * 1.5) + TABLE_LINE * 0.5;
    const { number, label, files, pages } = strings.columns;
    const cells: [string, number][] = [
      [number, COLUMN_X.number],
      [label, COLUMN_X.label],
      [files, COLUMN_X.files],
      [pages, COLUMN_X.pages],
    ];
    for (const [text, x] of cells) {
      flow.page.drawText(text, { x, y, size: TABLE_SIZE, font: fonts.bold, color: BLACK });
    }
    flow.page.drawLine({
      start: { x: MARGIN, y: y - 3 },
      end: { x: PAGE_WIDTH - MARGIN, y: y - 3 },
      thickness: 0.5,
      color: BLACK,
    });
  };

  drawHeader();
  for (const row of rows) {
    const lines = wrapLines(row.label, fonts.regular, TABLE_SIZE, LABEL_WIDTH);
    const height = lines.length * TABLE_LINE + 4;
    if (flow.y - height < MARGIN) {
      flow.newPage();
      drawHeader();
    }
    const top = flow.y - TABLE_SIZE - 2;
    const pages =
      row.firstPage === row.lastPage ? `${row.firstPage}` : `${row.firstPage}–${row.lastPage}`;
    const draw = (text: string, x: number, y = top) =>
      flow.page.drawText(text, { x, y, size: TABLE_SIZE, font: fonts.regular, color: BLACK });
    draw(String(row.number), COLUMN_X.number);
    lines.forEach((line, i) => {
      draw(line, COLUMN_X.label, top - i * TABLE_LINE);
    });
    draw(String(row.fileCount), COLUMN_X.files);
    draw(pages, COLUMN_X.pages);
    flow.reserve(height);
  }
  return flow.pages;
}

// ---------------------------------------------------------------------------
// Exhibits

export type AttachmentFile =
  | { kind: 'image'; mime: 'image/jpeg' | 'image/png'; bytes: Uint8Array }
  | { kind: 'pdf'; bytes: Uint8Array };

/** A prepared exhibit page: an embedded image or an embedded PDF page. */
export type ExhibitItem =
  | { kind: 'image'; image: PDFImage }
  | { kind: 'page'; page: PDFEmbeddedPage; rotation: number };

/** Loads an uploaded PDF, mapping failures to the handled errors in §8.5. */
export async function loadUploadedPdf(bytes: Uint8Array): Promise<PDFDocument> {
  let source: PDFDocument;
  try {
    // Load even if encrypted, then check: pdf-lib's EncryptedPDFError is an ES5
    // subclass of Error, so `instanceof` can't identify it.
    source = await PDFDocumentClass.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  } catch {
    throw new PdfUnreadableError('PDF could not be read');
  }
  if (source.isEncrypted) throw new PdfLockedError('PDF is encrypted');
  if (source.getPageCount() === 0) throw new PdfUnreadableError('PDF has no pages');
  return source;
}

/** Embeds one uploaded file; returns one item per resulting page. */
export async function prepareExhibit(
  doc: PDFDocument,
  file: AttachmentFile,
): Promise<ExhibitItem[]> {
  if (file.kind === 'image') {
    const image =
      file.mime === 'image/png' ? await doc.embedPng(file.bytes) : await doc.embedJpg(file.bytes);
    return [{ kind: 'image', image }];
  }
  const source = await loadUploadedPdf(file.bytes);
  const pages = source.getPages();
  try {
    const embedded = await doc.embedPages(pages);
    return embedded.map((page, i) => ({
      kind: 'page',
      page,
      rotation: (((pages[i]?.getRotation().angle ?? 0) % 360) + 360) % 360,
    }));
  } catch {
    throw new PdfUnreadableError('PDF pages could not be embedded');
  }
}

const HEADER_MAX_SIZE = 9;
const HEADER_MIN_SIZE = 7;

/** Draws one exhibit page: header line(s), then the item scaled to fit, centered. */
export function addExhibitPage(doc: PDFDocument, fonts: Fonts, header: string, item: ExhibitItem) {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  // Header: shrink 9 → 7pt to stay on one or two lines; below that, wrap as needed.
  let size = HEADER_MAX_SIZE;
  let lines = wrapLines(header, fonts.regular, size, CONTENT_WIDTH);
  while (lines.length > 2 && size > HEADER_MIN_SIZE) {
    size -= 0.5;
    lines = wrapLines(header, fonts.regular, size, CONTENT_WIDTH);
  }
  const lineHeight = size * 1.3;
  let y = PAGE_HEIGHT - MARGIN - size;
  for (const line of lines) {
    page.drawText(line, { x: MARGIN, y, size, font: fonts.regular, color: BLACK });
    y -= lineHeight;
  }
  const gap = 8;
  const area = {
    x: MARGIN,
    y: MARGIN,
    width: CONTENT_WIDTH,
    height: y + lineHeight - size - gap - MARGIN,
  };

  const rotation = item.kind === 'page' ? item.rotation : 0;
  const source = item.kind === 'image' ? item.image : item.page;
  const quarterTurn = rotation === 90 || rotation === 270;
  const visualWidth = quarterTurn ? source.height : source.width;
  const visualHeight = quarterTurn ? source.width : source.height;
  const scale = Math.min(area.width / visualWidth, area.height / visualHeight);
  const w = source.width * scale;
  const h = source.height * scale;
  const vx = area.x + (area.width - visualWidth * scale) / 2;
  const vy = area.y + (area.height - visualHeight * scale) / 2;

  if (item.kind === 'image') {
    page.drawImage(item.image, { x: vx, y: vy, width: w, height: h });
    return page;
  }
  // /Rotate is clockwise; pdf-lib's `rotate` is counterclockwise about (x, y).
  const placement: Record<number, { x: number; y: number }> = {
    0: { x: vx, y: vy },
    90: { x: vx, y: vy + w },
    180: { x: vx + w, y: vy + h },
    270: { x: vx + h, y: vy },
  };
  const at = placement[rotation] ?? { x: vx, y: vy };
  page.drawPage(item.page, {
    x: at.x,
    y: at.y,
    xScale: scale,
    yScale: scale,
    rotate: degrees(-rotation),
  });
  return page;
}

/** Light "PREVIEW, NOT SIGNED" label across the top of a page (§7 step 11). */
export function addPreviewHeader(page: PDFPage, fonts: Fonts, label: string) {
  const size = 10;
  const width = fonts.bold.widthOfTextAtSize(label, size);
  page.drawText(label, {
    x: (page.getWidth() - width) / 2,
    y: page.getHeight() - 20,
    size,
    font: fonts.bold,
    color: rgb(0.55, 0.55, 0.55),
  });
}
