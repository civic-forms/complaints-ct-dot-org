// JSON with recursively sorted object keys, so script output diffs cleanly
// between runs and between form revisions (CLAUDE.md §5.3).

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}
