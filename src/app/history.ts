// Browser and phone Back (CLAUDE.md §7), with the History API and no router.
// History holds only `{ page }`; the URL never changes. There are at most two
// app entries: the base entry (Welcome) and one pushed entry for whatever page
// is showing. Back lands on the base entry, and the app treats that like its
// own Back button, then pushes again. Forward from Welcome returns to the
// pushed page. Back on Welcome isn't intercepted, so it leaves the app.
//
// These are pure decisions; App.tsx applies them.

export const BASE_PAGE = 'welcome';

export const entryPage = (state: unknown): string | null => {
  const page = (state as { page?: unknown } | null)?.page;
  return typeof page === 'string' ? page : null;
};

export type NavOp = 'push' | 'replace' | 'back' | 'none';

/** What to do to history when the app shows `to` while history is on `entry`. */
export function navOp(entry: string | null, to: string): NavOp {
  if (entry === to) return 'none';
  if (to === BASE_PAGE) return entry === null ? 'replace' : 'back';
  return entry === BASE_PAGE ? 'push' : 'replace';
}

export type PopAction =
  | { kind: 'none' }
  /** Back: run the app's own Back. */
  | { kind: 'back' }
  /** Forward (or an older entry): show that page. */
  | { kind: 'show'; page: string }
  /** An entry we can't show: put Welcome back on it. */
  | { kind: 'reset' };

/**
 * A popstate landed on an entry for `entry` while the app shows `current`.
 * `canShow` says whether a page may be shown now (a form has started and the
 * page applies to the answers).
 */
export function popAction(
  entry: string | null,
  current: string,
  canShow: (page: string) => boolean,
): PopAction {
  if (entry === current) return { kind: 'none' };
  if (entry === BASE_PAGE) return { kind: 'back' };
  if (entry !== null && canShow(entry)) return { kind: 'show', page: entry };
  return { kind: 'reset' };
}
