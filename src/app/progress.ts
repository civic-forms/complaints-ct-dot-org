// "Step n of N" from the registry: only steps with `inProgress` count
// (not Welcome or Confirmation).

export function progressOf(
  steps: readonly { inProgress: boolean }[],
  index: number,
): { n: number; total: number } | null {
  if (!steps[index]?.inProgress) return null;
  const counted = steps.filter((s) => s.inProgress);
  return { n: steps.slice(0, index + 1).filter((s) => s.inProgress).length, total: counted.length };
}
