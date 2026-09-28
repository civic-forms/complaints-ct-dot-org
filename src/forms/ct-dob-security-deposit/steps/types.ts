// What every wizard step receives, and the registry entry shape.

import type { FunctionComponent } from 'preact';
import type { DepositComplaintState } from '../schema.ts';
import type { Issue } from '../validation.ts';
import type { UnsupportedChars } from '../values.ts';
import type { StepId } from './ids.ts';

export type Update = (recipe: (s: DepositComplaintState) => DepositComplaintState) => void;

export interface StepProps {
  state: DepositComplaintState;
  update: Update;
  goTo: (id: StepId) => void;
  next: () => void;
  /** Characters the form can't print, per field (live). */
  unsupported: readonly UnsupportedChars[];
  /** Soft warnings for the current state (§6.3). */
  warnings: readonly Issue[];
  /** Current sub-screen, for steps that have them. */
  sub: number;
  /** Narrow viewport (one question per sub-screen). */
  narrow: boolean;
}

export interface StepDef {
  id: StepId;
  /** The step's h1. */
  title: string;
  /** Counted in "Step n of N" (not Welcome or Confirmation). */
  inProgress: boolean;
  Component: FunctionComponent<StepProps>;
  /** Number of sub-screens; defaults to 1. */
  subScreens?: (narrow: boolean) => number;
  /** The step has its own primary action instead of Next (Back stays). */
  hideNext?: boolean;
}
