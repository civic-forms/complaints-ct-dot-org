// Browser and phone Back (CLAUDE.md §7): one history entry per page, the app's
// Back button is history.back(), and Forward redoes a Back. The decisions, and a
// fake History driven the way App.tsx drives it.

import { describe, expect, it } from 'vitest';
import { BASE_PAGE, entryPage, popAction, resumePath, shouldPush } from '../../src/app/history.ts';
import { isRelevant, nextIndex } from '../../src/app/progress.ts';
import { stepBackTo } from '../../src/core/erase/erase.ts';
import type { StepId } from '../../src/forms/ct-dob-security-deposit/steps/ids.ts';
import { PAGE_SPECS } from '../../src/forms/ct-dob-security-deposit/steps/pages.ts';
import { start } from '../helpers/flow.ts';

const pages = PAGE_SPECS;
const at = (id: string) => pages.findIndex((p) => p.id === id);

describe('history decisions', () => {
  it('pushes an entry for each page the app moves to, never for Welcome', () => {
    expect(shouldPush(BASE_PAGE, 'situation.intro')).toBe(true);
    expect(shouldPush('situation.intro', 'situation.movedOut')).toBe(true);
    expect(shouldPush('situation.movedOut', 'situation.movedOut')).toBe(false);
    expect(shouldPush('situation.intro', BASE_PAGE)).toBe(false);
  });

  it('shows the entry’s page, skips back over pages that no longer apply, and stays otherwise', () => {
    const yes = () => true;
    const no = () => false;
    expect(popAction('review', 'review', yes, at)).toEqual({ kind: 'none' });
    expect(popAction('comments', 'review', yes, at)).toEqual({ kind: 'show', page: 'comments' });
    expect(popAction(BASE_PAGE, 'review', no, at)).toEqual({ kind: 'show', page: BASE_PAGE });
    expect(popAction('situation.age62OrOlder', 'review', no, at)).toEqual({ kind: 'skipBack' });
    expect(popAction('review', 'comments', no, at)).toEqual({ kind: 'stay' });
    expect(popAction(null, 'review', yes, at)).toEqual({ kind: 'stay' });
  });

  it('reads only the page from history state', () => {
    expect(entryPage({ page: 'review' })).toBe('review');
    expect(entryPage(null)).toBeNull();
    expect(entryPage({ page: 3 })).toBeNull();
  });

  it('lists the pages that apply up to a resumed page, without detour pages', () => {
    const s = start({ gates: { movedOut: 'yes' } });
    const path = resumePath(pages, at('rental.intro'), (i) =>
      Boolean(!pages[i]?.detourOnly && isRelevant(pages, i, s)),
    );
    expect(path[0]).toBe('situation.intro');
    expect(path.at(-1)).toBe('rental.intro');
    expect(path).not.toContain('welcome');
    expect(path).not.toContain('situation.age62OrOlder');
    const toSend = resumePath(pages, at('send'), (i) =>
      Boolean(!pages[i]?.detourOnly && isRelevant(pages, i, s)),
    );
    expect(toSend).not.toContain('review.moreInfoNeeded');
  });
});

/** A browser history with synchronous popstate. */
class FakeHistory {
  entries: unknown[] = [null];
  at = 0;
  left = false;
  onPop: (state: unknown) => void = () => {};
  get state() {
    return this.entries[this.at];
  }
  get length() {
    return this.entries.length;
  }
  pushState(state: unknown) {
    this.entries = [...this.entries.slice(0, this.at + 1), state];
    this.at++;
  }
  replaceState(state: unknown) {
    this.entries[this.at] = state;
  }
  back() {
    if (this.at === 0) {
      this.left = true;
      return;
    }
    this.at--;
    this.onPop(this.state);
  }
  forward() {
    if (this.at === this.entries.length - 1) return;
    this.at++;
    this.onPop(this.state);
  }
}

/** The wizard as App.tsx drives it, minus the UI. */
function wizard() {
  let state = start({ gates: { movedOut: 'no', age62OrOlder: 'yes' } });
  state.meta.storageMode = 'session';
  const history = new FakeHistory();
  let index = 0;
  let edit: { origin: StepId; detour: boolean } | null = null;
  const id = () => pages[index]?.id as StepId;

  // In-app moves push an entry; moves that come from history don't.
  const show = (i: number, fromHistory = false) => {
    index = i;
    if (id() === 'review') edit = null;
    if (!fromHistory && shouldPush((history.state as { page?: string })?.page ?? null, id())) {
      history.pushState({ page: id() });
    }
  };
  const showFromHistory = (i: number) => {
    if (edit && id() === 'review.moreInfoNeeded' && pages[i]?.id === edit.origin) {
      edit = { ...edit, detour: false };
    }
    show(i, true);
  };
  const canShow = (p: string) =>
    p === 'review.moreInfoNeeded' ? edit !== null : isRelevant(pages, at(p), state);
  history.onPop = (entry) => {
    const act = popAction(entryPage(entry), id(), canShow, at);
    if (act.kind === 'show') showFromHistory(at(act.page));
    else if (act.kind === 'skipBack') history.back();
    else if (act.kind === 'stay') history.replaceState({ page: id() });
  };
  history.replaceState({ page: BASE_PAGE });

  return {
    history,
    id,
    edit: () => edit,
    set: (next: typeof state) => {
      state = next;
    },
    next: () => show(nextIndex(pages, index, state)),
    /** The app's Back button. */
    back: () => history.back(),
    goTo: (page: StepId, fromReview = false) => {
      if (fromReview) edit = { origin: page, detour: false };
      show(at(page));
    },
  };
}

describe('Back and Forward through the wizard', () => {
  it('Back (button or browser) returns page by page, and Back on Welcome leaves', () => {
    const w = wizard();
    for (let i = 0; i < 4; i++) w.next();
    expect(w.id()).toBe('situation.overLimitHeld');
    expect(w.history.length).toBe(5);
    w.history.back();
    expect(w.id()).toBe('situation.age62OrOlder');
    w.back();
    expect(w.id()).toBe('situation.movedOut');
    w.back();
    w.back();
    expect(w.id()).toBe('welcome');
    w.back();
    expect(w.history.left).toBe(true);
  });

  it('Forward redoes a Back, and Continue after Back drops the forward entries', () => {
    const w = wizard();
    for (let i = 0; i < 3; i++) w.next();
    w.back();
    w.back();
    w.history.forward();
    expect(w.id()).toBe('situation.movedOut');
    w.history.forward();
    expect(w.id()).toBe('situation.age62OrOlder');
    w.back();
    w.next();
    expect(w.history.length).toBe(4);
    w.history.forward();
    expect(w.id()).toBe('situation.age62OrOlder');
  });

  it('Back from an Edit page returns to Review, and from the interstitial to the edited page', () => {
    const w = wizard();
    w.goTo('review');
    w.goTo('situation.overLimitHeld', true);
    w.back();
    expect(w.id()).toBe('review');
    w.goTo('situation.overLimitHeld', true);
    w.goTo('review.moreInfoNeeded');
    w.history.back();
    expect(w.id()).toBe('situation.overLimitHeld');
    expect(w.edit()).toMatchObject({ origin: 'situation.overLimitHeld', detour: false });
  });

  it('skips back over a page that no longer applies', () => {
    const w = wizard();
    for (let i = 0; i < 3; i++) w.next();
    expect(w.id()).toBe('situation.age62OrOlder');
    w.next();
    // An edit elsewhere makes the 62-or-older page not apply any more.
    w.set(start({ gates: { movedOut: 'yes' } }));
    w.back();
    expect(w.id()).toBe('situation.movedOut');
  });
});

describe('stepping back to Welcome (erase)', () => {
  it('goes back entry by entry until the base entry', async () => {
    const h = new FakeHistory();
    h.replaceState({ page: BASE_PAGE });
    for (const page of ['a', 'b', 'c']) h.pushState({ page });
    const isBase = (s: unknown) => entryPage(s) === BASE_PAGE;
    await stepBackTo(h as unknown as History, isBase, async () => {});
    expect(entryPage(h.state)).toBe(BASE_PAGE);
    expect(h.left).toBe(false);
    // The filled-in entries are now forward of it.
    expect(h.length).toBe(4);
  });

  it('stops when Back goes nowhere', async () => {
    const h = new FakeHistory();
    h.replaceState({ page: 'a' });
    await stepBackTo(
      h as unknown as History,
      () => false,
      async () => {},
    );
    expect(h.left).toBe(true);
  });
});
