// Dates are stored as ISO "YYYY-MM-DD" and formatted only at render (CLAUDE.md §5.1).
// String-based on purpose: going through Date would shift days across time zones.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string | null | undefined): value is string {
  const match = value ? ISO_DATE.exec(value) : null;
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  if (m < 1 || m > 12 || d < 1) return false;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= daysInMonth;
}

/** "2026-03-05" → "03/05/26". Returns "" for empty or invalid input. */
export function formatDateMMDDYY(iso: string | null | undefined): string {
  if (!isIsoDate(iso)) return '';
  const [y, m, d] = iso.split('-') as [string, string, string];
  return `${m}/${d}/${y.slice(-2)}`;
}

/** Today's date in the user's local time zone, as ISO "YYYY-MM-DD". */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
