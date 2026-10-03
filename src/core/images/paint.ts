// The canvas pass of the image pipeline (CLAUDE.md §8.5), written against a
// minimal 2D-context interface so it is unit tested without a browser.

/** The part of CanvasRenderingContext2D (or the OffscreenCanvas one) this uses. */
export interface PaintContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, w: number, h: number): void;
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
  putImageData(data: ImageData, dx: number, dy: number): void;
}

/**
 * Draws the image onto white, so transparent areas (e.g. in a PNG screenshot)
 * come out white in the JPEG instead of black.
 */
export function paintOnWhite(
  ctx: PaintContext,
  image: CanvasImageSource,
  width: number,
  height: number,
): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
}

/** Converts what is on the canvas to grayscale, in place. */
export function grayscaleInPlace(ctx: PaintContext, width: number, height: number): void {
  const image = ctx.getImageData(0, 0, width, height);
  toLuminance(image.data);
  ctx.putImageData(image, 0, 0);
}

/** RGBA → gray (Rec. 601 luma), in place. Alpha is left as is. */
export function toLuminance(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0);
    data[i] = y;
    data[i + 1] = y;
    data[i + 2] = y;
  }
}
