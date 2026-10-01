// State builders for flow tests: apply answers the way the wizard does
// (normalizeGates after every change).

import {
  type DepositComplaintState,
  initialState,
} from '../../src/forms/ct-dob-security-deposit/schema.ts';
import { normalizeGates } from '../../src/forms/ct-dob-security-deposit/situation.ts';

type Gates = DepositComplaintState['gates'];
type Questions = DepositComplaintState['questions'];

export interface Answers {
  gates?: Partial<Omit<Gates, 'confirmed'>> & { confirmed?: Partial<Gates['confirmed']> };
  fwd?: Partial<DepositComplaintState['forwardingAddress']>;
  questions?: { [K in keyof Questions]?: Partial<Questions[K]> };
}

/** Apply answers to a state, then normalize as the wizard's update wrapper does. */
export function answer(state: DepositComplaintState, a: Answers): DepositComplaintState {
  const questions = { ...state.questions };
  for (const [key, value] of Object.entries(a.questions ?? {})) {
    const k = key as keyof Questions;
    (questions as Record<string, unknown>)[k] = { ...questions[k], ...value };
  }
  return normalizeGates({
    ...state,
    gates: {
      ...state.gates,
      ...a.gates,
      confirmed: { ...state.gates.confirmed, ...a.gates?.confirmed },
    },
    forwardingAddress: { ...state.forwardingAddress, ...a.fwd },
    questions,
  });
}

export const start = (a: Answers = {}) => answer(initialState(), a);
