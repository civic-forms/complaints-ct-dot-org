// Phone numbers are formatted at render only (CLAUDE.md §8.2).

/** "8605550123" or "860-555-0123" → "(860) 555-0123"; anything else as typed. */
export function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  const trimmed = input.trim();
  // Only reformat when the input is clearly a plain 10-digit number
  // (no letters, extensions, or country codes).
  if (digits.length === 10 && /^[\d\s().+-]*$/.test(trimmed) && !trimmed.startsWith('+')) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return trimmed;
}
