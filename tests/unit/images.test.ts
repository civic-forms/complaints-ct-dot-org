// The image pipeline's pure parts (CLAUDE.md §8.5). Decoding and encoding run
// in the browser and are checked there.

import { describe, expect, it } from 'vitest';
import { fitWithin, sameAspect } from '../../src/core/images/geometry.ts';
import {
  grayscaleInPlace,
  type PaintContext,
  paintOnWhite,
  toLuminance,
} from '../../src/core/images/paint.ts';
import { SMALLER, STANDARD } from '../../src/core/images/presets.ts';

describe('fitWithin', () => {
  it('scales the long edge down to the limit, keeping the shape', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(4000, 1000, 1200)).toEqual({ width: 1200, height: 300 });
  });

  it('never upscales', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 900, 1600)).toEqual({ width: 1600, height: 900 });
  });

  it('keeps at least one pixel on a very thin image', () => {
    expect(fitWithin(10000, 2, 1600)).toEqual({ width: 1600, height: 1 });
  });
});

describe('sameAspect', () => {
  it('accepts rounding differences and rejects a swapped orientation', () => {
    expect(sameAspect({ width: 1600, height: 1201 }, { width: 1600, height: 1200 })).toBe(true);
    expect(sameAspect({ width: 1200, height: 1600 }, { width: 1600, height: 1200 })).toBe(false);
  });
});

describe('presets', () => {
  it('match §8.5', () => {
    expect([STANDARD.maxEdge, STANDARD.quality]).toEqual([1600, 0.7]);
    expect([SMALLER.maxEdge, SMALLER.quality]).toEqual([1200, 0.6]);
  });
});

/** A fake 2D context that records calls and holds one image's pixels. */
function fakeContext(pixels: Uint8ClampedArray) {
  const calls: string[] = [];
  const ctx: PaintContext = {
    fillStyle: '',
    fillRect: (...args) => calls.push(`fillRect ${String(ctx.fillStyle)} ${args.join(',')}`),
    drawImage: (_image, ...args) => calls.push(`drawImage ${args.join(',')}`),
    getImageData: () => ({ data: pixels }) as ImageData,
    putImageData: () => calls.push('putImageData'),
  };
  return { ctx, calls };
}

describe('the canvas pass', () => {
  it('fills the canvas with white before drawing, so transparency becomes white', () => {
    const { ctx, calls } = fakeContext(new Uint8ClampedArray());
    paintOnWhite(ctx, {} as CanvasImageSource, 1600, 1200);
    expect(calls).toEqual(['fillRect #ffffff 0,0,1600,1200', 'drawImage 0,0,1600,1200']);
  });

  it('converts to gray with Rec. 601 weights, keeping alpha', () => {
    const data = new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 10, 20, 30, 255,
    ]);
    toLuminance(data);
    expect([...data]).toEqual([
      76, 76, 76, 255, 150, 150, 150, 128, 29, 29, 29, 0, 18, 18, 18, 255,
    ]);
  });

  it('grayscaleInPlace reads, converts, and writes back the canvas pixels', () => {
    const pixels = new Uint8ClampedArray([200, 100, 50, 255]);
    const { ctx, calls } = fakeContext(pixels);
    grayscaleInPlace(ctx, 1, 1);
    expect([...pixels]).toEqual([124, 124, 124, 255]);
    expect(calls).toEqual(['putImageData']);
  });
});
