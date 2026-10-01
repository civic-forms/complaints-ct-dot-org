// The signature (CLAUDE.md §14): trimming the drawn signature to its ink, and
// which method counts.

import { describe, expect, it } from 'vitest';
import { inkBounds, padRect } from '../../src/core/signature/trim.ts';
import { initialState } from '../../src/forms/ct-dob-security-deposit/schema.ts';
import {
  hasSignature,
  typedSignatureText,
} from '../../src/forms/ct-dob-security-deposit/signature.ts';

function canvas(width: number, height: number, ink: [number, number][]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y] of ink) data[(y * width + x) * 4 + 3] = 255;
  return data;
}

describe('inkBounds', () => {
  it('is null for an empty pad', () => {
    expect(inkBounds(canvas(10, 5, []), 10, 5)).toBeNull();
  });

  it('is the box around every inked pixel', () => {
    const data = canvas(10, 6, [
      [2, 1],
      [7, 4],
      [5, 2],
    ]);
    expect(inkBounds(data, 10, 6)).toEqual({ x: 2, y: 1, width: 6, height: 4 });
  });

  it('ignores near-transparent antialiasing below the threshold', () => {
    const data = canvas(4, 4, [[1, 1]]);
    data[(3 * 4 + 3) * 4 + 3] = 5;
    expect(inkBounds(data, 4, 4)).toEqual({ x: 1, y: 1, width: 1, height: 1 });
  });
});

describe('padRect', () => {
  it('grows the box and clamps it to the canvas', () => {
    expect(padRect({ x: 2, y: 1, width: 6, height: 4 }, 4, 10, 6)).toEqual({
      x: 0,
      y: 0,
      width: 10,
      height: 6,
    });
    expect(padRect({ x: 20, y: 20, width: 10, height: 10 }, 4, 100, 100)).toEqual({
      x: 16,
      y: 16,
      width: 18,
      height: 18,
    });
  });
});

describe('hasSignature', () => {
  const sig = initialState().signature;

  it('starts unsigned, drawn, with an empty typed name', () => {
    expect(sig).toMatchObject({ method: 'drawn', pngDataUrl: null, typedName: '' });
    expect(hasSignature(sig)).toBe(false);
  });

  it('counts only the selected method', () => {
    const drawn = { ...sig, pngDataUrl: 'data:image/png;base64,AA==' };
    expect(hasSignature(drawn)).toBe(true);
    expect(hasSignature({ ...drawn, method: 'typed' })).toBe(false);
    const typed = { ...sig, method: 'typed' as const, typedName: 'Jane Doe' };
    expect(hasSignature(typed)).toBe(true);
    expect(hasSignature({ ...typed, method: 'drawn' })).toBe(false);
    expect(hasSignature({ ...typed, typedName: '   ' })).toBe(false);
  });

  it('prints a typed signature as "/s/ {name}"', () => {
    expect(typedSignatureText('  Jane   Q.  Doe ')).toBe('/s/ Jane Q. Doe');
  });
});
