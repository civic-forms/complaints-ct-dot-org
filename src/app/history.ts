// Browser and phone Back (CLAUDE.md §7), with the History API and no router.
// History holds only `{ page }`; the URL never changes. One entry per page
// visited: every forward move in the app (Continue, Next, Skip, an Edit link)
// pushes an entry, and the app's Back button is `history.back()`. So the phone's
// Back, iOS swipe-back (with a preview of the real previous page), and the
// button are one action, and Forward redoes a Back. The first entry of a page
// load is Welcome (the base entry); Back on Welcome leaves the app.
//
// These are pure decisions; App.tsx applies them.

export const BASE_PAGE = 'welcome';

export const entryPage = (state: unknown): string | null => {
  const page = (state as { page?: unknown } | null)?.page;
  return typeof page === 'string' ? page : null;
};

/** Push an entry when the app moves to a page history isn't already on. */
export const shouldPush = (entry: string | null, to: string): boolean =>
  entry !== to && to !== BASE_PAGE;

export type PopAction =
  | { kind: 'none' }
  /** Show the entry's page. */
  | { kind: 'show'; page: string }
  /** A page that no longer applies, behind the current one: keep going back. */
  | { kind: 'skipBack' }
  /** A page that can't be shown ahead (or no page at all): stay, and relabel the entry. */
  | { kind: 'stay' };

/**
 * A popstate landed on an entry for `entry` while the app shows `current`.
 * `canShow` says whether a page may be shown now (a form has started and the
 * page applies to the answers); `order` gives a page's place in the flow.
 */
export function popAction(
  entry: string | null,
  current: string,
  canShow: (page: string) => boolean,
  order: (page: string) => number,
): PopAction {
  if (entry === null) return { kind: 'stay' };
  if (entry === current) return { kind: 'none' };
  if (entry === BASE_PAGE || canShow(entry)) return { kind: 'show', page: entry };
  return order(entry) < order(current) ? { kind: 'skipBack' } : { kind: 'stay' };
}

/**
 * The entries to push when a saved form resumes on `target`: every page that
 * applies from the first one up to it, so Back walks the form, not to Welcome.
 */
export function resumePath<P extends { id: string }>(
  pages: readonly P[],
  target: number,
  applies: (index: number) => boolean,
): string[] {
  const path: string[] = [];
  for (let i = 1; i <= target; i++) if (applies(i)) path.push(pages[i]?.id ?? '');
  return path.filter(Boolean);
}
