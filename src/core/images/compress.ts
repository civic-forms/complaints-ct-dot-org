// Image compression in the browser (CLAUDE.md §8.5): decode with EXIF
// orientation, scale to the preset's long edge, draw onto white, and encode as
// JPEG, in color and in grayscale from the same decode. The caller discards the
// original.

import { createObjectUrl, revokeObjectUrl } from '../blob-urls.ts';
import { ImageDecodeError } from './errors.ts';
import { fitWithin, type Size, sameAspect } from './geometry.ts';
import { grayscaleInPlace, type PaintContext, paintOnWhite } from './paint.ts';
import type { ImagePreset } from './presets.ts';

export interface CompressedImage {
  color: Blob;
  gray: Blob;
  width: number;
  height: number;
}

export async function compressImage(source: Blob, preset: ImagePreset): Promise<CompressedImage> {
  const bitmap = await decode(source, preset.maxEdge);
  const size = fitWithin(bitmap.width, bitmap.height, preset.maxEdge);
  const canvas = makeCanvas(size);
  try {
    const ctx = canvas.getContext('2d') as PaintContext | null;
    if (!ctx) throw new Error('No 2D canvas context');
    paintOnWhite(ctx, bitmap, size.width, size.height);
    bitmap.close();
    const color = await toJpeg(canvas, preset.quality);
    grayscaleInPlace(ctx, size.width, size.height);
    const gray = await toJpeg(canvas, preset.quality);
    return { color, gray, ...size };
  } finally {
    bitmap.close();
    // Safari keeps canvas memory until the size is reset.
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * Decodes at (or near) the target size where the browser supports it, so a
 * full-resolution phone photo is never held in memory at full size. Falls back
 * to a full decode, resized on the canvas, when the size can't be read, the
 * resize options throw, or the result has the wrong shape.
 */
async function decode(source: Blob, maxEdge: number): Promise<ImageBitmap> {
  const natural = await probeSize(source).catch(() => null);
  if (natural) {
    const target = fitWithin(natural.width, natural.height, maxEdge);
    if (target.width < natural.width) {
      const resized = await createImageBitmap(source, {
        imageOrientation: 'from-image',
        resizeWidth: target.width,
        resizeHeight: target.height,
        resizeQuality: 'high',
      }).catch(() => null);
      // A browser that ignores the options returns the full size; the canvas resizes it.
      if (resized && sameAspect(resized, target)) return resized;
      resized?.close();
    }
  }
  try {
    return await createImageBitmap(source, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageDecodeError('Image could not be decoded');
  }
}

/** The image's size after EXIF orientation, read through an <img> element. */
function probeSize(source: Blob): Promise<Size> {
  if (typeof Image === 'undefined') return Promise.reject(new Error('No Image element'));
  const url = createObjectUrl(source);
  const img = new Image();
  return new Promise<Size>((resolve, reject) => {
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      } else reject(new Error('No size'));
    };
    img.onerror = () => reject(new Error('Not decodable'));
    img.src = url;
  }).finally(() => {
    img.removeAttribute('src');
    revokeObjectUrl(url);
  });
}

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

function makeCanvas({ width, height }: Size): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function toJpeg(canvas: AnyCanvas, quality: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: 'image/jpeg', quality });
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('JPEG encoding failed'))),
      'image/jpeg',
      quality,
    );
  });
}
