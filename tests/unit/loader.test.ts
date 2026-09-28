import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPdfAssets } from '../../src/forms/ct-dob-security-deposit/assets.ts';
import { TEMPLATE_FILENAME } from '../../src/forms/ct-dob-security-deposit/config.ts';
import { decodeDataUrl } from '../../src/forms/ct-dob-security-deposit/template/loader.ts';
import { loadAssets } from '../helpers/assets.ts';

const TEMPLATE_DIR = join(import.meta.dirname, '../../src/forms/ct-dob-security-deposit/template');

describe('template loader (CLAUDE.md §8)', () => {
  it('returns the committed template bytes, matching template.sha256', async () => {
    const { template } = await loadPdfAssets();
    expect(Buffer.from(template).equals(Buffer.from(loadAssets().template))).toBe(true);
    const [expected] = readFileSync(join(TEMPLATE_DIR, 'template.sha256'), 'utf8').split(/\s+/);
    expect(createHash('sha256').update(template).digest('hex')).toBe(expected);
  });

  it('is memoized', async () => {
    expect(await loadPdfAssets()).toBe(await loadPdfAssets());
  });

  it('imports the file named in config.ts and template.sha256 (§5.3)', () => {
    const source = readFileSync(join(TEMPLATE_DIR, 'loader.ts'), 'utf8');
    const imports = [...source.matchAll(/from '\.\/([^']+)\?inline'/g)].map((m) => m[1]);
    expect(imports).toEqual([TEMPLATE_FILENAME]);
    const hashFile = readFileSync(join(TEMPLATE_DIR, 'template.sha256'), 'utf8');
    expect(hashFile.trim().split(/\s+/)[1]).toBe(TEMPLATE_FILENAME);
  });

  it('decodes base64 and percent-encoded data URLs', () => {
    expect([...decodeDataUrl('data:application/pdf;base64,JVBERg==')]).toEqual([37, 80, 68, 70]);
    expect([...decodeDataUrl('data:text/plain,%25PDF')]).toEqual([37, 80, 68, 70]);
  });
});
