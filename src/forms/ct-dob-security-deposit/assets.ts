// Lazy access to the PDF runtime assets (CLAUDE.md §8). The template lives in
// its own chunk, loaded as a module on first use, never with fetch().

import type { PdfAssets } from '../../core/pdf/assemble.ts';

let pending: Promise<PdfAssets> | null = null;

export function loadPdfAssets(): Promise<PdfAssets> {
  pending ??= import('./template/loader.ts').then((m) => m.loadTemplateAssets());
  // Let a failed load be retried.
  pending.catch(() => {
    pending = null;
  });
  return pending;
}
