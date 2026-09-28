// Fixed-format address inputs, kept within the form's boxes (CLAUDE.md §7):
// State is two letters, Zip is five digits.

/** Keeps letters A–Z, uppercased, at most 2. "ct" → "CT", "Mass." → "MA". */
export function normalizeState(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2);
}

/** Keeps digits, at most 5, so a pasted ZIP+4 "06103-1234" becomes "06103". */
export function normalizeZip(input: string): string {
  return input.replace(/\D/g, '').slice(0, 5);
}
