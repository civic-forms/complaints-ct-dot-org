import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { progressOf } from '../../src/app/progress.ts';
import { STEP_IDS } from '../../src/forms/ct-dob-security-deposit/steps/ids.ts';
import { STEPS } from '../../src/forms/ct-dob-security-deposit/steps/index.ts';
import en from '../../src/i18n/en.json' with { type: 'json' };
import { t } from '../../src/i18n/t.ts';

describe('step registry', () => {
  it('lists every step once, in §7 order', () => {
    expect(STEPS.map((s) => s.id)).toEqual([...STEP_IDS]);
  });

  it('counts progress from the registry, without Welcome', () => {
    const counted = STEPS.filter((s) => s.inProgress).length;
    expect(STEPS[0]?.id).toBe('welcome');
    expect(progressOf(STEPS, 0)).toBeNull();
    expect(progressOf(STEPS, 1)).toEqual({ n: 1, total: counted });
    expect(progressOf(STEPS, STEPS.length - 1)).toEqual({ n: counted, total: counted });
  });

  it('skips steps outside the count wherever they are', () => {
    const steps = [
      { inProgress: false },
      { inProgress: true },
      { inProgress: true },
      { inProgress: false },
    ];
    expect(progressOf(steps, 2)).toEqual({ n: 2, total: 2 });
    expect(progressOf(steps, 3)).toBeNull();
  });
});

describe('disclaimer copy (§10)', () => {
  // The text needs maintainer approval to change; keep en.json in step with CLAUDE.md.
  it('matches CLAUDE.md §10 word for word', () => {
    const claude = readFileSync(join(import.meta.dirname, '../../CLAUDE.md'), 'utf8');
    const section = claude.split('## 10. Disclaimer')[1]?.split('\n## ')[0] ?? '';
    const quoted = section
      .split('\n')
      .filter((line) => line.startsWith('>'))
      .map((line) => line.replace(/^>\s?/, ''))
      .join(' ');
    const norm = (s: string) =>
      s
        .replace(/\*\*/g, '')
        .replace(/☐|\[ | \]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const d = en.disclaimer;
    const ours = [
      d.heading,
      ...d.sections.map((s) => `${s.title} ${s.body}`),
      d.checkNotLawyer,
      d.checkResponsible,
      d.agree,
    ]
      .join(' ')
      .replaceAll('{operator}', '[Operator Name]');
    expect(norm(ours)).toBe(norm(quoted));
  });

  it('fills {appName} and {operator} from app', () => {
    expect(t('{appName} / {operator}')).toBe(`${en.app.name} / ${en.app.operator}`);
  });
});
