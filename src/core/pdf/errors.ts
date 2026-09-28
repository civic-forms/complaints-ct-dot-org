// Handled errors from PDF import (CLAUDE.md §8.5, §19.4 known issues).

/** An uploaded PDF is encrypted / password-protected. */
export class PdfLockedError extends Error {
  override name = 'PdfLockedError';
}

/** An uploaded PDF couldn't be parsed or has no pages. */
export class PdfUnreadableError extends Error {
  override name = 'PdfUnreadableError';
}
