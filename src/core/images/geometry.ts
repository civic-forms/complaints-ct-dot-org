// Size math for the image pipeline (CLAUDE.md §8.5). Pure, so it is unit tested.

export interface Size {
  width: number;
  height: number;
}

/** Scales down so the long edge is at most `maxEdge`. Never upscales. */
export function fitWithin(width: number, height: number, maxEdge: number): Size {
  const long = Math.max(width, height);
  if (long <= maxEdge) return { width, height };
  const scale = maxEdge / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Whether two sizes have the same shape, allowing for rounding. Used to catch a
 * browser that applies the decode-time resize before EXIF orientation, which
 * would squash a rotated photo.
 */
export function sameAspect(a: Size, b: Size, tolerance = 0.02): boolean {
  const ra = a.width / a.height;
  const rb = b.width / b.height;
  return Math.abs(ra - rb) / rb <= tolerance;
}
