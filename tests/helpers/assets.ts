// Loads the PDF template from disk for tests and scripts. In the browser it is
// loaded as a module, never fetched (CLAUDE.md §8).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PdfAssets } from '../../src/core/pdf/assemble.ts';
import { TEMPLATE_FILENAME } from '../../src/forms/ct-dob-security-deposit/config.ts';

const ROOT = join(import.meta.dirname, '../..');

export const read = (path: string) => new Uint8Array(readFileSync(join(ROOT, path)));

export function loadAssets(): PdfAssets {
  return {
    template: read(`src/forms/ct-dob-security-deposit/template/${TEMPLATE_FILENAME}`),
  };
}
