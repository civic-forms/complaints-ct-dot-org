// Address inputs (CLAUDE.md §7), the towns list, and naming (§4).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WIN_ANSI } from '../../src/core/pdf/text.ts';
import towns from '../../src/forms/ct-dob-security-deposit/ct-towns.json' with { type: 'json' };
import { addressAttrs } from '../../src/forms/ct-dob-security-deposit/steps/kit.ts';
import { softWarnings } from '../../src/forms/ct-dob-security-deposit/validation.ts';
import {
  collectUnsupportedChars,
  textValue,
} from '../../src/forms/ct-dob-security-deposit/values.ts';
import { makeState } from '../fixtures/states.ts';

const KEYS = [
  'name',
  'street',
  'streetLine2',
  'city',
  'state',
  'zip',
  'daytimePhone',
  'email',
] as const;

describe('address inputs', () => {
  it('gives the tenant full autocomplete tokens', () => {
    expect(KEYS.map((k) => addressAttrs('tenant', k).autoComplete)).toEqual([
      'name',
      'address-line1',
      'address-line2',
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

const repo = join(import.meta.dirname, '../..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    // Untracked: script output, dependencies, and dotfiles such as .DS_Store.
    if (name === 'out' || name === 'node_modules' || name.startsWith('.')) return [];
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

describe('naming (§4)', () => {
  it('uses kebab-case file names, except files named after a component or hook', () => {
    const kebab = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+)+$/;
    const offenders = ['src', 'tests', 'scripts']
      .flatMap((dir) => walk(join(repo, dir)))
      .filter((path) => {
        const name = basename(path);
        if (kebab.test(name)) return false;
        const hook = name.match(/^(use[A-Z][A-Za-z0-9]*)\.tsx?$/)?.[1];
        const component = name.match(/^([A-Z][A-Za-z0-9]*)\.tsx$/)?.[1];
        const exported = hook ?? component;
        if (!exported) return true;
        const source = readFileSync(path, 'utf8');
        return !new RegExp(`export (function|const) ${exported}\\b`).test(source);
      })
      .map((path) => relative(repo, path));
    expect(offenders).toEqual([]);
  });

  // Complaint types are named by their ComplaintType keys; form positions
  // ("box 1") belong only in field-map.ts.
  it('never refers to a complaint type as "box N" outside field-map.ts', () => {
    const root = join(repo, 'src');
    const offenders = walk(root)
      .filter((f) => /\.(ts|tsx|json)$/.test(f) && !f.endsWith('field-map.ts'))
      .filter((f) => /\bbox ?[1-4]\b/i.test(readFileSync(f, 'utf8')))
      .map((f) => relative(root, f));
    expect(offenders).toEqual([]);
  });
});

describe('second street line', () => {
  it('prints in the form’s one street box, after the street', () => {
    const state = makeState({
      tenant: { street: ' 12 Elm St ', streetLine2: ' Apt 4B ' },
      landlord: { street: '1 Main St', streetLine2: '' },
      rental: { unitStreet: '', streetLine2: 'Unit 3' },
    });
    expect(textValue('tenant.street', state)).toBe('12 Elm St, Apt 4B');
    expect(textValue('landlord.street', state)).toBe('1 Main St');
    expect(textValue('rental.unitStreet', state)).toBe('Unit 3');
  });

  it('is optional: an empty second line adds no warning', () => {
    const state = makeState({ tenant: { street: '12 Elm St', streetLine2: '' } });
    const ids = softWarnings(state, {
      unsupportedChars: [],
      slotFileCounts: {},
      today: '2026-10-02',
    }).map((w) => w.id);
    expect(ids.some((id) => id.includes('streetLine2'))).toBe(false);
  });

  it('shares the street box’s character check', () => {
    const state = makeState({ landlord: { street: '1 Main St', streetLine2: 'Mieszkanie 5ł' } });
    expect(collectUnsupportedChars(state, WIN_ANSI)).toContainEqual(
      expect.objectContaining({ path: 'landlord.street', chars: ['ł'] }),
    );
  });

  it('keeps the landlord’s earlier field ids', () => {
    expect(addressAttrs('landlord', 'name').id).toBe('ll-1');
    expect(addressAttrs('landlord', 'email').id).toBe('ll-7');
    expect(addressAttrs('landlord', 'streetLine2').id).toBe('ll-8');
  });
});
