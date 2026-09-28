// Minimal PNG encoder for synthetic test images (no binary fixtures needed).

import { crc32, deflateSync } from 'node:zlib';

function chunk(type: string, data: Uint8Array): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Encodes RGBA pixels (width * height * 4 bytes) as a PNG. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', new Uint8Array()),
    ]),
  );
}

/** A transparent PNG with a dark scribble, like a trimmed signature. */
export function signaturePng(width = 480, height = 120): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  const plot = (x: number, y: number) => {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const px = Math.round(x + dx);
        const py = Math.round(y + dy);
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const i = (py * width + px) * 4;
        rgba.set([20, 20, 60, 255], i);
      }
    }
  };
  for (let t = 0; t < 1; t += 0.0005) {
    const x = 10 + t * (width - 20);
    const y = height / 2 + Math.sin(t * 26) * (height / 3) * (1 - t * 0.5) + Math.cos(t * 7) * 8;
    plot(x, y);
  }
  return encodePng(width, height, rgba);
}

export function pngDataUrl(bytes: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
}

/**
 * An opaque, colorful "photo" (sky, ground, sun, a house) for the color
 * "Other documents" slot. Clearly not a document or a signature.
 */
export function photoPng(width = 1600, height = 1000): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  const horizon = height * 0.62;
  const sun = { x: width * 0.78, y: height * 0.22, r: height * 0.1 };
  const house = { x0: width * 0.2, x1: width * 0.45, y0: height * 0.4, y1: horizon };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let color: [number, number, number];
      const roofTop = house.y0 - (house.x1 - house.x0) / 2;
      const roofHalf = ((y - roofTop) / (house.y0 - roofTop)) * ((house.x1 - house.x0) / 2);
      const mid = (house.x0 + house.x1) / 2;
      if ((x - sun.x) ** 2 + (y - sun.y) ** 2 < sun.r ** 2) {
        color = [250, 200, 40];
      } else if (x > house.x0 && x < house.x1 && y > house.y0 && y < house.y1) {
        const door = x > mid - 30 && x < mid + 30 && y > house.y1 - 120;
        color = door ? [110, 60, 30] : [200, 70, 60];
      } else if (y > roofTop && y <= house.y0 && Math.abs(x - mid) < roofHalf) {
        color = [90, 50, 40];
      } else if (y < horizon) {
        const t = y / horizon;
        color = [Math.round(90 + 90 * t), Math.round(150 + 60 * t), 235];
      } else {
        const t = (y - horizon) / (height - horizon);
        color = [Math.round(60 - 20 * t), Math.round(150 - 50 * t), Math.round(60 - 20 * t)];
      }
      rgba.set([...color, 255], (y * width + x) * 4);
    }
  }
  return encodePng(width, height, rgba);
}
