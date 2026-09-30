// Wizard navigation, as pure functions over the page registry (CLAUDE.md §7):
// which pages are relevant, where Continue and Back go, whether a page can be
// left, chapter progress, and the Review edit detour.

export interface NavPage<S, Id extends string = string, Chapter extends string = string> {
  id: Id;
  chapter: Chapter | null;
  kind: 'intro' | 'page' | 'note';
  when?: (s: S) => boolean;
  answer?: { skippable: boolean; done: (s: S) => boolean };
  detourOnly?: true;
}

/**
 * A page appears when its own `when` holds. A chapter intro appears only when
 * some other page in its chapter does, so a chapter with nothing to ask is
 * skipped whole.
 */
export function isRelevant<S>(pages: readonly NavPage<S>[], index: number, state: S): boolean {
  const page = pages[index];
  if (!page) return false;
  if (page.kind === 'intro') {
    return pages.some(
      (p, i) => i !== index && p.chapter === page.chapter && isRelevant(pages, i, state),
    );
  }
  return page.when ? page.when(state) : true;
}

export function nextIndex<S>(pages: readonly NavPage<S>[], index: number, state: S): number {
  for (let i = index + 1; i < pages.length; i++) if (isRelevant(pages, i, state)) return i;
  return index;
}

export function prevIndex<S>(pages: readonly NavPage<S>[], index: number, state: S): number {
  for (let i = index - 1; i >= 0; i--) if (isRelevant(pages, i, state)) return i;
  return index;
}

/** Continue (and Save and return) need the page's answer; Back and Skip never do. */
export function canContinue<S>(page: NavPage<S>, state: S): boolean {
  return !page.answer || page.answer.done(state);
}

/**
 * "About your landlord · 2 of 4": position among the chapter's relevant pages,
 * not counting its intro or conditional notes (which show the chapter title only).
 */
export function chapterProgress<S, C extends string>(
  pages: readonly NavPage<S, string, C>[],
  index: number,
  state: S,
): { chapter: C; n: number | null; total: number; chapterN: number; chapterTotal: number } | null {
  const page = pages[index];
  if (!page?.chapter) return null;
  const inChapter = pages
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p, i }) => p.chapter === page.chapter && p.kind === 'page' && isRelevant(pages, i, state),
    );
  const n = inChapter.findIndex(({ i }) => i === index);
  const chapters: C[] = [];
  pages.forEach((p, i) => {
    if (p.chapter && !chapters.includes(p.chapter) && isRelevant(pages, i, state)) {
      chapters.push(p.chapter);
    }
  });
  if (!chapters.includes(page.chapter)) chapters.push(page.chapter);
  return {
    chapter: page.chapter,
    // One-page chapters show just their title.
    n: n >= 0 && inChapter.length > 1 ? n + 1 : null,
    total: inChapter.length,
    chapterN: chapters.indexOf(page.chapter) + 1,
    chapterTotal: chapters.length,
  };
}

/** Relevant pages whose answer is still missing (skipped or not reached yet). */
export function pendingIds<S, Id extends string>(
  pages: readonly NavPage<S, Id>[],
  state: S,
): Set<Id> {
  const out = new Set<Id>();
  pages.forEach((p, i) => {
    if (p.answer && !p.answer.done(state) && isRelevant(pages, i, state)) out.add(p.id);
  });
  return out;
}

/**
 * Pages an edit made newly relevant and unanswered, in flow order: pending now
 * but not when the edit began (`before`). Pages skipped earlier are in `before`,
 * so they never start a detour.
 */
export function newlyPending<S, Id extends string>(
  pages: readonly NavPage<S, Id>[],
  before: ReadonlySet<Id>,
  state: S,
  exclude?: Id,
): Id[] {
  const now = pendingIds(pages, state);
  return pages.map((p) => p.id).filter((id) => now.has(id) && !before.has(id) && id !== exclude);
}

/** An edit opened from Review ("Save and return to review"). */
export interface EditSession<Id extends string> {
  /** Pages pending when the edit began, plus any left unanswered since. */
  before: ReadonlySet<Id>;
  /** Past the edited page, on the interstitial or a revealed page. */
  detour: boolean;
}

export type EditAction<Id extends string> =
  | { to: 'review' }
  | { to: 'interstitial'; count: number }
  | { to: 'page'; id: Id };

/**
 * Where the primary button goes during an edit, from page `current`. On the
 * edited page: straight back to Review, or to the interstitial when the change
 * revealed unanswered pages. On the interstitial and revealed pages: the next
 * revealed page, then Review.
 */
export function editAction<S, Id extends string>(
  pages: readonly NavPage<S, Id>[],
  session: EditSession<Id>,
  current: Id,
  state: S,
): EditAction<Id> {
  const remaining = newlyPending(pages, session.before, state, current);
  const first = remaining[0];
  if (!first) return { to: 'review' };
  if (!session.detour) return { to: 'interstitial', count: remaining.length };
  return { to: 'page', id: first };
}
