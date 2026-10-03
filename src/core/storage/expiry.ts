// 30-day expiry (CLAUDE.md §9.2): a draft not saved for more than 30 days is
// cleared on load.

export const EXPIRY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** True when `savedAt` is more than 30 days before `now`, or isn't a valid timestamp. */
export function isExpired(savedAt: string | null, now: Date): boolean {
  const time = savedAt ? Date.parse(savedAt) : Number.NaN;
  if (Number.isNaN(time)) return true;
  return now.getTime() - time > EXPIRY_DAYS * DAY_MS;
}
