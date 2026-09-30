// Address inputs (CLAUDE.md §7), the towns list, and naming (§4).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import towns from '../../src/forms/ct-dob-security-deposit/ct-towns.json' with { type: 'json' };
import { addressAttrs } from '../../src/forms/ct-dob-security-deposit/steps/kit.ts';

const KEYS = ['name', 'street', 'city', 'state', 'zip', 'daytimePhone', 'email'] as const;

describe('address inputs', () => {
  it('gives the tenant full autocomplete tokens', () => {
    expect(KEYS.map((k) => addressAttrs('tenant', k).autoComplete)).toEqual([
      'name',
      'street-address',
      'address-level2',
      'address-level1',
      'postal-code',
      'tel',
      'email',
    ]);
  });

  it("keeps the landlord's fields from looking like the user's own address", () => {
    const giveaway = /name|street|address|city|state|zip|postal|tel|phone|mail/i;
    const ids = new Set<string>();
    for (const key of KEYS) {
      const attrs = addressAttrs('landlord', key);
      expect(attrs.autoComplete).toBe('off');
      expect(attrs.id).not.toMatch(giveaway);
      expect(attrs.name).not.toMatch(giveaway);
      ids.add(attrs.id);
    }
    expect(ids.size).toBe(KEYS.length);
  });
});

describe("Connecticut's towns (rental City/Town suggestions)", () => {
  it('lists all 169, once each, sorted', () => {
    expect(towns).toHaveLength(169);
    expect(new Set(towns).size).toBe(169);
    expect([...towns].sort()).toEqual(towns);
  });
});

describe('naming (§4)', () => {
  // Complaint types are named by their ComplaintType keys; form positions
  // ("box 1") belong only in field-map.ts.
  it('never refers to a complaint type as "box N" outside field-map.ts', () => {
    const root = join(import.meta.dirname, '../../src');
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? files(path) : [path];
      });
    const offenders = files(root)
      .filter((f) => /\.(ts|tsx|json)$/.test(f) && !f.endsWith('field-map.ts'))
      .filter((f) => /\bbox ?[1-4]\b/i.test(readFileSync(f, 'utf8')))
      .map((f) => relative(root, f));
    expect(offenders).toEqual([]);
  });
});
