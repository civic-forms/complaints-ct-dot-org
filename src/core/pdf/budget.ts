// Packet size budget (CLAUDE.md §8.5) and the coarse buckets telemetry may
// report (§19.3 `packet_built`). Exact byte counts are never reported.

const MB = 1024 * 1024;

export const WARN_BYTES = 8 * MB;
/** Base64 in email adds ~33%, so 10 MB of PDF is about 13.3 MB on the wire. */
export const CAP_BYTES = 10 * MB;

export type BudgetStatus = 'ok' | 'warn' | 'over';

export function budgetStatus(bytes: number): BudgetStatus {
  if (bytes > CAP_BYTES) return 'over';
  if (bytes > WARN_BYTES) return 'warn';
  return 'ok';
}

/** Largest items first, so the user can see what to remove when over the cap. */
export function largestAttachments<T extends { bytes: number }>(items: readonly T[], limit = 5) {
  return [...items].sort((a, b) => b.bytes - a.bytes).slice(0, limit);
}

export type SizeBucket = 'lt2mb' | '2to5mb' | '5to8mb' | '8to10mb' | 'over10mb';
export type PageBucket = 'lt10' | '10to20' | '20to40' | 'gt40';

export function sizeBucket(bytes: number): SizeBucket {
  if (bytes < 2 * MB) return 'lt2mb';
  if (bytes < 5 * MB) return '2to5mb';
  if (bytes < 8 * MB) return '5to8mb';
  if (bytes <= CAP_BYTES) return '8to10mb';
  return 'over10mb';
}

export function pageBucket(pages: number): PageBucket {
  if (pages < 10) return 'lt10';
  if (pages <= 20) return '10to20';
  if (pages <= 40) return '20to40';
  return 'gt40';
}
