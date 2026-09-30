import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canContinue,
  chapterProgress,
  editAction,
  newlyPending,
  nextIndex,
  pendingIds,
  prevIndex,
} from '../../src/app/progress.ts';
import { initialState } from '../../src/forms/ct-dob-security-deposit/schema.ts';
import {
  CHAPTER_IDS,
  STEP_IDS,
  type StepId,
} from '../../src/forms/ct-dob-security-deposit/steps/ids.ts';
import { PAGES } from '../../src/forms/ct-dob-security-deposit/steps/index.ts';
import { PAGE_SPECS, specOf } from '../../src/forms/ct-dob-security-deposit/steps/pages.ts';
import en from '../../src/i18n/en.json' with { type: 'json' };
import { t } from '../../src/i18n/t.ts';
import { answer, start } from '../helpers/flow.ts';

const pages = PAGE_SPECS;
const at = (id: StepId) => pages.findIndex((p) => p.id === id);
const idAt = (i: number) => pages[i]?.id;

describe('page registry', () => {
  it('lists every page once, in flow order', () => {
    expect(PAGES.map((p) => p.id)).toEqual([...STEP_IDS]);
    expect(new Set(STEP_IDS).size).toBe(STEP_IDS.length);
  });

  it('gives every page a component, and a title unless its question is the h1', () => {
    for (const page of PAGES) expect(page.Component).toBeTypeOf('function');
    for (const page of PAGES.filter((p) => p.kind === 'intro')) expect(page.title).toBeTruthy();
  });

  it('opens each chapter with an intro, except the one-page ones and Read and sign', () => {
    const noIntro = ['comments', 'disclaimer', 'review', 'sign'];
    for (const chapter of CHAPTER_IDS) {
      const first = pages.find((p) => p.chapter === chapter);
      expect(first?.kind === 'intro', chapter).toBe(!noIntro.includes(chapter));
    }
  });

  it('keeps chapters together, in chapter order', () => {
    const order = pages.map((p) => p.chapter).filter((c) => c !== null);
    const runs = order.filter((c, i) => c !== order[i - 1]);
    expect(runs).toEqual([...CHAPTER_IDS]);
  });
});

describe('navigation', () => {
  const currentTenant = start({ gates: { movedOut: 'no' } });

  it('skips pages that do not apply', () => {
    expect(idAt(nextIndex(pages, at('situation.movedOut'), currentTenant))).toBe(
      'situation.age62OrOlder',
    );
    const former = start({ gates: { movedOut: 'yes' } });
    expect(idAt(nextIndex(pages, at('situation.movedOut'), former))).toBe('deposit.intro');
  });

  it('skips a whole chapter, intro included, when nothing in it applies', () => {
    expect(idAt(nextIndex(pages, at('deposit.neededDocs'), currentTenant))).toBe('aboutYou.intro');
    expect(idAt(prevIndex(pages, at('aboutYou.intro'), currentTenant))).toBe('deposit.neededDocs');
  });

  it('never enters the edit interstitial in the normal flow', () => {
    expect(idAt(nextIndex(pages, at('review'), currentTenant))).toBe('sign.statements');
  });

  it('shows progress within the chapter', () => {
    const s = initialState();
    expect(chapterProgress(pages, at('landlord.address'), s)).toMatchObject({
      chapter: 'landlord',
      n: 2,
      total: 4,
    });
    expect(chapterProgress(pages, at('landlord.intro'), s)).toMatchObject({ n: null });
    expect(chapterProgress(pages, at('welcome'), s)).toBeNull();
    // Move Out is skipped for current tenants, so the chapter is one shorter.
    expect(chapterProgress(pages, at('rental.moveIn'), s)?.total).toBe(7);
    expect(chapterProgress(pages, at('rental.moveIn'), currentTenant)?.total).toBe(6);
  });

  it('needs an answer to continue, or Skip where offered', () => {
    const page = (id: StepId) => specOf(id);
    const s = initialState();
    // App choice: no skip.
    expect(canContinue(page('situation.movedOut'), s)).toBe(false);
    expect(page('situation.movedOut').answer?.skippable).toBe(false);
    expect(canContinue(page('situation.movedOut'), start({ gates: { movedOut: 'no' } }))).toBe(
      true,
    );
    // The form's YES/NO: skippable.
    expect(canContinue(page('deposit.depositReturned'), s)).toBe(false);
    expect(page('deposit.depositReturned').answer).toMatchObject({
      kind: 'choice',
      skippable: true,
    });
    // Information: every non-optional field.
    const address = page('aboutYou.address');
    expect(address.answer).toMatchObject({ kind: 'info', skippable: true });
    const partial = {
      ...s,
      tenant: { ...s.tenant, street: '1 Main St', city: 'Hartford', state: 'CT' },
    };
    expect(canContinue(address, partial)).toBe(false);
    expect(canContinue(address, { ...partial, tenant: { ...partial.tenant, zip: '06103' } })).toBe(
      true,
    );
    // Optional: continues when empty.
    for (const id of ['aboutYou.email', 'rental.housingComplex', 'comments'] as const) {
      expect(canContinue(page(id), s)).toBe(true);
    }
  });
});

describe('Review edit detour', () => {
  const session = (before: ReturnType<typeof pendingIds<unknown, StepId>>) => ({
    before,
    detour: false,
  });

  it('routes over-limit No → Yes through the interstitial to the confirmation', () => {
    const before = start({
      gates: { movedOut: 'no', age62OrOlder: 'yes', overLimitHeld: 'no', bankInfoGiven: 'yes' },
    });
    const edit = session(pendingIds(pages, before));
    const after = answer(before, { gates: { overLimitHeld: 'yes' } });
    expect(editAction(pages, edit, 'situation.overLimitHeld', after)).toEqual({
      to: 'interstitial',
      count: 1,
    });
    const detour = { ...edit, detour: true };
    const confirm = 'situation.confirm.currentTenant62PlusExcessOverOneMonth';
    expect(editAction(pages, detour, 'review.moreInfoNeeded', after)).toEqual({
      to: 'page',
      id: confirm,
    });
    // On the last revealed page, the primary action returns to Review.
    expect(editAction(pages, detour, confirm, after)).toEqual({ to: 'review' });
  });

  it('routes depositReturned → YES through the interstitial to the amount page', () => {
    const before = start({
      gates: { movedOut: 'yes', confirmed: { formerTenantDepositNotReturned: 'yes' } },
      questions: { depositReturned: { answer: 'no' } },
    });
    const edit = session(pendingIds(pages, before));
    const after = answer(before, { questions: { depositReturned: { answer: 'yes' } } });
    // Amount, check cashed, and "Was it the full amount?"
    expect(editAction(pages, edit, 'deposit.depositReturned', after)).toEqual({
      to: 'interstitial',
      count: 3,
    });
    expect(editAction(pages, { ...edit, detour: true }, 'review.moreInfoNeeded', after)).toEqual({
      to: 'page',
      id: 'deposit.returnedAmount',
    });
  });

  it('goes straight back to Review when nothing new needs an answer', () => {
    const before = start({ gates: { movedOut: 'no' } });
    const edit = session(pendingIds(pages, before));
    const after = { ...before, tenant: { ...before.tenant, name: 'Jordan' } };
    expect(editAction(pages, edit, 'aboutYou.name', after)).toEqual({ to: 'review' });
  });

  it('does not start a detour for a page skipped before the edit', () => {
    const before = start({ gates: { movedOut: 'no' } });
    const edit = session(pendingIds(pages, before));
    expect(edit.before.has('landlord.phone')).toBe(true);
    expect(newlyPending(pages, edit.before, before)).toEqual([]);
    expect(editAction(pages, edit, 'landlord.name', before)).toEqual({ to: 'review' });
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
