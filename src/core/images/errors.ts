// Handled errors from the image pipeline (CLAUDE.md §8.5, §19.4 known issues).

/** The browser couldn't decode the image (e.g. HEIC where unsupported). */
export class ImageDecodeError extends Error {
  override name = 'ImageDecodeError';
}
