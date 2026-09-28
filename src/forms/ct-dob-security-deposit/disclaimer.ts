// Disclaimer gate (CLAUDE.md §7 step 10, §10). No PDF is built until the
// current disclaimer version is accepted.

import { DISCLAIMER_VERSION } from './config.ts';
import type { DepositComplaintState } from './schema.ts';

export function isDisclaimerAccepted(state: DepositComplaintState): boolean {
  return (
    state.meta.disclaimerVersion === DISCLAIMER_VERSION && Boolean(state.meta.disclaimerAcceptedAt)
  );
}

export function acceptDisclaimer(
  state: DepositComplaintState,
  now: Date = new Date(),
): DepositComplaintState {
  return {
    ...state,
    meta: {
      ...state.meta,
      disclaimerVersion: DISCLAIMER_VERSION,
      disclaimerAcceptedAt: now.toISOString(),
    },
  };
}
