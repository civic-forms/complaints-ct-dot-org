// Cropping the signature to its ink (CLAUDE.md §14). Pure, so it is unit tested.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The bounding box of pixels with alpha above `threshold`, or null if there's no ink. */
export function inkBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 8,
): Rect | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if ((data[row + x * 4 + 3] ?? 0) > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Grows a rect by `pad` on every side, clamped to the canvas. */
export function padRect(rect: Rect, pad: number, width: number, height: number): Rect {
  const x = Math.max(0, rect.x - pad);
  const y = Math.max(0, rect.y - pad);
  return {
    x,
    y,
    width: Math.min(width, rect.x + rect.width + pad) - x,
    height: Math.min(height, rect.y + rect.height + pad) - y,
  };
}
