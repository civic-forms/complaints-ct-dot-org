// Synthetic PDFs for attachment tests.

import { degrees, PDFDocument, PDFName, rgb, StandardFonts } from 'pdf-lib';

/** Three pages: Letter portrait, A4 landscape, and a Letter page with /Rotate 90. */
export async function sampleAttachmentPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages: [number, number, number][] = [
    [612, 792, 0],
    [842, 595, 0],
    [612, 792, 90],
  ];
  pages.forEach(([w, h, rotate], i) => {
    const page = doc.addPage([w, h]);
    page.setRotation(degrees(rotate));
    page.drawRectangle({
      x: 10,
      y: 10,
      width: w - 20,
      height: h - 20,
      borderWidth: 2,
      borderColor: rgb(0, 0, 0),
    });
    page.drawText(`Sample attachment page ${i + 1} (${w}x${h}, rotate ${rotate})`, {
      x: 40,
      y: h - 60,
      size: 18,
      font,
    });
    page.drawText('TOP', { x: w / 2 - 20, y: h - 100, size: 28, font });
  });
  return doc.save();
}

/** A PDF whose trailer declares encryption, which pdf-lib refuses to load. */
export async function lockedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.context.trailerInfo.Encrypt = doc.context.register(
    doc.context.obj({ Filter: PDFName.of('Standard'), V: 2, R: 3 }),
  );
  return doc.save();
}

export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  /** Font size, from the text matrix. */
  size: number;
}

/** The text drawn on one page (1-based), with positions, via pdfjs (dev-only). */
export async function pageText(bytes: Uint8Array, pageNumber: number): Promise<TextItem[]> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: bytes.slice(), useSystemFonts: false, verbosity: 0 });
  const doc = await task.promise;
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  const items = content.items.flatMap((item) => {
    if (!('str' in item)) return [];
    const [a = 0, b = 0, , , x = 0, y = 0] = item.transform as number[];
    return [{ str: item.str, x, y, width: item.width, size: Math.hypot(a, b) }];
  });
  await task.destroy();
  return items;
}
