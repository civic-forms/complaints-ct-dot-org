// The complaint-type gates (CLAUDE.md §6.1, §7 question pattern). Gates only
// remove people who clearly can't apply; the confirmation page is where the
// user decides. Only a Yes on a confirmation checks a type on the form, and
// nothing here is inferred from entered amounts (§2.2).

import {
  COMPLAINT_TYPES,
  type ComplaintType,
  type ComplaintTypes,
  type DepositComplaintState,
} from './schema.ts';

/** Whether the confirmation page for `type` can appear, from the answers so far. */
export function isReachable(state: DepositComplaintState, type: ComplaintType): boolean {
  const g = state.gates;
  switch (type) {
    case 'formerTenantDepositNotReturned':
      return (
        g.movedOut === 'yes' &&
        !(state.questions.depositReturned.answer === 'yes' && g.fullAmountReturned === 'yes')
      );
    case 'currentTenant62PlusExcessOverOneMonth':
      return g.movedOut === 'no' && g.age62OrOlder === 'yes' && g.overLimitHeld !== 'no';
    case 'currentTenantUnder62ExcessOverTwoMonths':
      return g.movedOut === 'no' && g.age62OrOlder === 'no' && g.overLimitHeld !== 'no';
    case 'currentTenantNoEscrowInfo':
      return g.movedOut === 'no' && g.bankInfoGiven !== 'yes';
  }
}

export function isChecked(state: DepositComplaintState, type: ComplaintType): boolean {
  return isReachable(state, type) && state.gates.confirmed[type] === 'yes';
}

export const anyChecked = (state: DepositComplaintState) =>
  COMPLAINT_TYPES.some((type) => state.complaintTypes[type]);

/**
 * Run after every update. Clears the confirmation of any type that is no longer
 * reachable, so it must be confirmed again if it comes back (the one exception
 * to §6.2), then derives `complaintTypes` from the confirmations.
 */
export function normalizeGates(state: DepositComplaintState): DepositComplaintState {
  const confirmed = { ...state.gates.confirmed };
  let cleared = false;
  for (const type of COMPLAINT_TYPES) {
    if (confirmed[type] !== null && !isReachable(state, type)) {
      confirmed[type] = null;
      cleared = true;
    }
  }
  const gates = cleared ? { ...state.gates, confirmed } : state.gates;
  const next = { ...state, gates };
  const complaintTypes: ComplaintTypes = {
    formerTenantDepositNotReturned: isChecked(next, 'formerTenantDepositNotReturned'),
    currentTenant62PlusExcessOverOneMonth: isChecked(next, 'currentTenant62PlusExcessOverOneMonth'),
    currentTenantUnder62ExcessOverTwoMonths: isChecked(
      next,
      'currentTenantUnder62ExcessOverTwoMonths',
    ),
    currentTenantNoEscrowInfo: isChecked(next, 'currentTenantNoEscrowInfo'),
  };
  const same = COMPLAINT_TYPES.every((type) => complaintTypes[type] === state.complaintTypes[type]);
  if (same && !cleared) return state;
  return { ...next, complaintTypes: same ? state.complaintTypes : complaintTypes };
}
