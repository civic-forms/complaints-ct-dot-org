// Wizard step IDs (CLAUDE.md §7), in order. Kept apart from the step components
// so validation and (later) telemetry can use them without loading any UI.

import type { TextPath } from '../fieldMap.ts';

export const STEP_IDS = [
  'welcome',
  'situation',
  'needs',
  'aboutYou',
  'landlord',
  'rental',
  'money',
  'moreQuestions',
  'documents',
  'comments',
  'disclaimer',
  'review',
  'sign',
] as const;

export type StepId = (typeof STEP_IDS)[number];

/** The step where each text field is entered (for Edit links). */
export function stepOfPath(path: TextPath): StepId {
  if (path.startsWith('tenant.')) return 'aboutYou';
  if (path.startsWith('landlord.')) return 'landlord';
  switch (path) {
    case 'rental.monthlyRentCents':
    case 'rental.lastRentPaidDate':
    case 'rental.securityDepositCents':
    case 'rental.otherDepositCents':
    case 'questions.depositReturned.amountCents':
    case 'questions.interestPaid.payments':
      return 'money';
    case 'questions.courtAction.docketNumber':
    case 'questions.roommates.names':
    case 'questions.landlordOtherProperties.addresses':
      return 'moreQuestions';
    case 'additionalComments':
      return 'comments';
    default:
      return 'rental';
  }
}
