// Text preparation and fitting for PDF output (CLAUDE.md §8.2, §8.3).

/** The subset of pdf-lib's PDFFont used for measuring. */
export interface MeasureFont {
  widthOfTextAtSize(text: string, size: number): number;
  heightAtSize(size: number, options?: { descender?: boolean }): number;
}

/** Code points the PDF font can encode (for pdf-lib's standard fonts: WinAnsi). */
export interface Charset {
  has(codePoint: number): boolean;
}

/** The encodable character set of a pdf-lib font. */
export function charsetOf(font: { getCharacterSet(): number[] }): Charset {
  return new Set(font.getCharacterSet());
}

// Code points WinAnsi maps into 0x80–0x9F (€ ‚ ƒ „ … † ‡ ˆ ‰ Š ‹ Œ Ž ‘ ’ “ ” • – — ˜ ™ š › œ ž Ÿ).
const WIN_ANSI_EXTRAS = [
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
];

/**
 * What pdf-lib's standard fonts (Helvetica, WinAnsi) can encode, without
 * loading pdf-lib: printable ASCII, Latin-1, and the WinAnsi extras. A test
 * checks it against `charsetOf(Helvetica)`. Used to warn as the user types.
 */
export const WIN_ANSI: Charset = new Set<number>([
  ...Array.from({ length: 0x7f - 0x20 }, (_, i) => 0x20 + i),
  ...Array.from({ length: 0x100 - 0xa0 }, (_, i) => 0xa0 + i),
  ...WIN_ANSI_EXTRAS,
]);

export interface SanitizeResult {
  text: string;
  /** Characters the font can't encode, replaced with "?"; each listed once, in order of first appearance. */
  replaced: string[];
}

const REPLACEMENT = '?';

/**
 * Normalizes text for the PDF font: NFC, CRLF → LF, tabs and other control
 * characters → space, and any character the font can't encode → "?".
 * Newlines are kept; single-line callers flatten them separately.
 */
export function sanitize(input: string, charset: Charset): SanitizeResult {
  const replaced: string[] = [];
  let text = '';
  for (const char of input.normalize('NFC').replace(/\r\n?/g, '\n')) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (char === '\n') {
      text += char;
    } else if (codePoint < 0x20 || (codePoint >= 0x7f && codePoint < 0xa0)) {
      text += ' ';
    } else if (charset.has(codePoint)) {
      text += char;
    } else {
      text += REPLACEMENT;
      if (!replaced.includes(char)) replaced.push(char);
    }
  }
  return { text, replaced };
}

/** Collapses newlines for single-line fields. */
export function toSingleLine(text: string): string {
  return text.trim().replace(/\s*\n\s*/g, '; ');
}

// pdf-lib only keeps a line when its width is strictly less than the box, so
// wrap slightly narrower to guarantee it never re-wraps our lines.
const WRAP_SAFETY = 0.5;

/**
 * Greedy word wrap. Keeps the user's own line breaks (and blank lines); breaks
 * words longer than the line by character.
 */
export function wrapLines(text: string, font: MeasureFont, size: number, maxWidth: number) {
  const limit = maxWidth - WRAP_SAFETY;
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= limit;
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ').filter(Boolean);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (fits(candidate)) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      // Break an over-long word into pieces that fit.
      let rest = word;
      while (!fits(rest)) {
        let cut = 1;
        const chars = Array.from(rest);
        while (cut < chars.length && fits(chars.slice(0, cut + 1).join(''))) cut++;
        lines.push(chars.slice(0, cut).join(''));
        rest = chars.slice(cut).join('');
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

export interface Box {
  width: number;
  height: number;
}

export interface FitOptions {
  multiline: boolean;
  maxSize?: number;
  minSize?: number;
  step?: number;
}

export interface FitResult {
  size: number;
  /** For multiline fields: the pre-wrapped lines. For single-line: one line. */
  lines: string[];
}

/** Line height pdf-lib uses for multiline text fields. */
export function multilineLineHeight(font: MeasureFont, size: number): number {
  return font.heightAtSize(size) * 1.2;
}

/**
 * Tries sizes from maxSize down to minSize (§8.3: 10pt → 7pt). Returns the
 * largest size at which the text fits the box, or null if it overflows even
 * at minSize.
 */
export function fitText(
  text: string,
  font: MeasureFont,
  box: Box,
  { multiline, maxSize = 10, minSize = 7, step = 0.5 }: FitOptions,
): FitResult | null {
  for (let size = maxSize; size >= minSize - 1e-9; size -= step) {
    if (multiline) {
      const lines = wrapLines(text, font, size, box.width);
      if (lines.length * multilineLineHeight(font, size) <= box.height) return { size, lines };
    } else {
      const fitsWidth = font.widthOfTextAtSize(text, size) <= box.width - WRAP_SAFETY;
      const fitsHeight = font.heightAtSize(size, { descender: false }) <= box.height;
      if (fitsWidth && fitsHeight) return { size, lines: [text] };
    }
  }
  return null;
}
