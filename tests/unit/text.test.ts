import { PDFDocument, StandardFonts } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type Charset,
  charsetOf,
  fitText,
  type MeasureFont,
  multilineLineHeight,
  sanitize,
  toSingleLine,
  wrapLines,
} from '../../src/core/pdf/text.ts';

let font: MeasureFont;
let charset: Charset;

beforeAll(async () => {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  font = helvetica;
  charset = charsetOf(helvetica);
});

describe('sanitize', () => {
  it('replaces characters WinAnsi can\'t encode with "?" and reports each once', () => {
    const result = sanitize('Hi 😀 Łódź 😀 ✓ 中 Ωμ Пр', charset);
    expect(result.text).toBe('Hi ? ?ód? ? ? ? ?? ??');
    expect(result.replaced).toEqual(['😀', 'Ł', 'ź', '✓', '中', 'Ω', 'μ', 'П', 'р']);
  });

  it('keeps Western European letters and typographic punctuation', () => {
    const text = 'José Núñez-Müller Ætna Œuvre – “quoted” ’s … € ·';
    expect(sanitize(text, charset)).toEqual({ text, replaced: [] });
  });

  it('normalizes to NFC', () => {
    const decomposed = 'José';
    const { text } = sanitize(decomposed, charset);
    expect(text).toBe('José');
    expect(text.length).toBe(4);
  });

  it('turns tabs and control characters into spaces and keeps newlines', () => {
    expect(sanitize('a\tb\r\nc\u0007d\re', charset).text).toBe('a b\nc d\ne');
  });

  it('collapses newlines for single-line fields', () => {
    expect(toSingleLine('1 Main St\n  Apt 2\n')).toBe('1 Main St; Apt 2');
  });
});

describe('wrapLines', () => {
  it('wraps at word boundaries within the width', () => {
    const lines = wrapLines('alpha beta gamma delta epsilon', font, 10, 80);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(font.widthOfTextAtSize(line, 10)).toBeLessThan(80);
    expect(lines.join(' ')).toBe('alpha beta gamma delta epsilon');
  });

  it('breaks words longer than a line', () => {
    const lines = wrapLines('x'.repeat(200), font, 10, 100);
    expect(lines.join('')).toBe('x'.repeat(200));
    for (const line of lines) expect(font.widthOfTextAtSize(line, 10)).toBeLessThan(100);
  });

  it("keeps the user's blank lines", () => {
    expect(wrapLines('one\n\ntwo', font, 10, 500)).toEqual(['one', '', 'two']);
  });
});

describe('fitText', () => {
  const box = { width: 120, height: 16 };

  it('uses 10pt when the text fits', () => {
    expect(fitText('Short', font, box, { multiline: false })).toEqual({
      size: 10,
      lines: ['Short'],
    });
  });

  it('shrinks toward 7pt before overflowing', () => {
    const text = 'A somewhat longer value here';
    const fit = fitText(text, font, box, { multiline: false });
    expect(fit).not.toBeNull();
    expect(fit?.size).toBeLessThan(10);
    expect(fit?.size).toBeGreaterThanOrEqual(7);
    expect(font.widthOfTextAtSize(text, fit?.size ?? 0)).toBeLessThanOrEqual(box.width);
  });

  it('returns null when text overflows even at 7pt', () => {
    expect(fitText('word '.repeat(40), font, box, { multiline: false })).toBeNull();
  });

  it('fits multiline text by lines × line height', () => {
    const area = { width: 530, height: 57 };
    const fit = fitText('Some comments. '.repeat(20), font, area, { multiline: true });
    expect(fit).not.toBeNull();
    const size = fit?.size ?? 0;
    expect((fit?.lines.length ?? 0) * multilineLineHeight(font, size)).toBeLessThanOrEqual(57);
    expect(fitText('x '.repeat(3000), font, area, { multiline: true })).toBeNull();
  });
});
