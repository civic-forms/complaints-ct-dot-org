// Money is stored as integer cents and formatted only at render (CLAUDE.md §8.2).

/** 125000 → "$1,250.00". Returns "" for null. */
export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return '';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const rest = (abs % 100).toString().padStart(2, '0');
  return `${sign}$${dollars}.${rest}`;
}

/**
 * Parses what a user types into integer cents: "1,250", "$1250.5", " 12.05 ".
 * Returns null for empty or invalid input (negative amounts are invalid).
 */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/^\$\s*/, '')
    .replace(/,/g, '');
  if (!/^\d+(\.\d{0,2})?$|^\.\d{1,2}$/.test(cleaned)) return null;
  const [whole = '', fraction = ''] = cleaned.split('.');
  const cents = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}
