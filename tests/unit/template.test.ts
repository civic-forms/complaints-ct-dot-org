import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const TEMPLATE_DIR = join(import.meta.dirname, '../../src/forms/ct-dob-security-deposit/template');

describe('form template', () => {
  it('matches the committed SHA-256 (CLAUDE.md §5)', () => {
    const [expectedHash, fileName] = readFileSync(join(TEMPLATE_DIR, 'template.sha256'), 'utf8')
      .trim()
      .split(/\s+/);
    expect(fileName).toBeTruthy();
    const actualHash = createHash('sha256')
      .update(readFileSync(join(TEMPLATE_DIR, fileName as string)))
      .digest('hex');
    expect(actualHash).toBe(expectedHash);
  });
});
