// Browser and phone Back (CLAUDE.md §7): the history decisions, and a run of
// them against a fake History wired the way App.tsx wires it.

import { describe, expect, it } from 'vitest';
import { BASE_PAGE, entryPage, navOp, popAction } from '../../src/app/history.ts';
import { isRelevant, nextIndex, prevIndex } from '../../src/app/progress.ts';
import type { StepId } from '../../src/forms/ct-dob-security-deposit/steps/ids.ts';
import { PAGE_SPECS } from '../../src/forms/ct-dob-security-deposit/steps/pages.ts';
import { start } from '../helpers/flow.ts';

const pages = PAGE_SPECS;
const at = (id: StepId) => pages.findIndex((p) => p.id === id);

describe('history decisions', () => {
  it('pushes once on leaving Welcome, then replaces', () => {
    expect(navOp(BASE_PAGE, 'situation.intro')).toBe('push');
    expect(navOp('situation.intro', 'situation.movedOut')).toBe('replace');
    expect(navOp('situation.movedOut', 'situation.movedOut')).toBe('none');
    expect(navOp('situation.intro', BASE_PAGE)).toBe('back');
    expect(navOp(null, BASE_PAGE)).toBe('replace');
  });

  it('reads Back, Forward, and stale entries', () => {
    const yes = () => true;
    const no = () => false;
    expect(popAction(BASE_PAGE, 'review', yes)).toEqual({ kind: 'back' });
    expect(popAction(BASE_PAGE, BASE_PAGE, yes)).toEqual({ kind: 'none' });
    expect(popAction('review', BASE_PAGE, yes)).toEqual({ kind: 'show', page: 'review' });
    expect(popAction('review', BASE_PAGE, no)).toEqual({ kind: 'reset' });
    expect(popAction(null, BASE_PAGE, yes)).toEqual({ kind: 'reset' });
  });

  it('reads only the page from history state', () => {
    expect(entryPage({ page: 'review' })).toBe('review');
    expect(entryPage(null)).toBeNull();
    expect(entryPage({ page: 3 })).toBeNull();
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
  const state = start({ gates: { movedOut: 'no', age62OrOlder: 'yes' } });
  state.meta.storageMode = 'session';
  const history = new FakeHistory();
  let index = 0;
  let edit: { origin: StepId } | null = null;
  const id = () => pages[index]?.id as StepId;

  const sync = () => {
    const op = navOp(entryPage(history.state), id());
    if (op === 'push') history.pushState({ page: id() });
    else if (op === 'replace') history.replaceState({ page: id() });
    else if (op === 'back') history.back();
  };
  const show = (i: number) => {
    index = i;
    sync();
  };
  // App.tsx's back(): the interstitial returns to the edited page.
  const back = () => {
    if (edit && id() === 'review.moreInfoNeeded') {
      show(at(edit.origin));
      return;
    }
    show(prevIndex(pages, index, state));
  };
  history.onPop = (entry) => {
    const act = popAction(entryPage(entry), id(), (p) => isRelevant(pages, at(p as StepId), state));
    if (act.kind === 'back') back();
    else if (act.kind === 'show') show(at(act.page as StepId));
    else if (act.kind === 'reset') history.replaceState({ page: id() });
  };
  history.replaceState({ page: BASE_PAGE });

  return {
    history,
    id,
    next: () => show(nextIndex(pages, index, state)),
    back,
    goTo: (page: StepId, fromReview = false) => {
      if (fromReview) edit = { origin: page };
      show(at(page));
    },
  };
}

describe('Back and Forward through the wizard', () => {
  it('steps back page by page with the browser, never growing history', () => {
    const w = wizard();
    for (let i = 0; i < 4; i++) w.next();
    expect(w.id()).toBe('situation.overLimitHeld');
    expect(w.history.length).toBe(2);
    w.history.back();
    expect(w.id()).toBe('situation.age62OrOlder');
    w.history.back();
    expect(w.id()).toBe('situation.movedOut');
    expect(w.history.length).toBe(2);
    expect(w.history.left).toBe(false);
  });

  it('reaches Welcome, and Back from Welcome leaves the app', () => {
    const w = wizard();
    w.next();
    w.history.back();
    expect(w.id()).toBe('welcome');
    w.history.back();
    expect(w.history.left).toBe(true);
  });

  it('Forward from Welcome returns to the page just left', () => {
    const w = wizard();
    w.next();
    w.next();
    w.history.back();
    w.history.back();
    expect(w.id()).toBe('welcome');
    w.history.forward();
    expect(w.id()).toBe('situation.intro');
  });

  it("the in-app Back and the browser's agree, including Welcome", () => {
    const w = wizard();
    w.next();
    w.back();
    expect(w.id()).toBe('welcome');
    expect(entryPage(w.history.state)).toBe(BASE_PAGE);
    w.history.back();
    expect(w.history.left).toBe(true);
  });

  it('Back from the edit interstitial returns to the edited page', () => {
    const w = wizard();
    w.goTo('review');
    w.goTo('situation.overLimitHeld', true);
    w.goTo('review.moreInfoNeeded');
    w.history.back();
    expect(w.id()).toBe('situation.overLimitHeld');
  });
});
