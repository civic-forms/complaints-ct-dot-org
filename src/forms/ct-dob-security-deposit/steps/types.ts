// What every wizard page receives, and the registry entry shape.

import type { FunctionComponent } from 'preact';
import type { DepositComplaintState } from '../schema.ts';
import type { Issue } from '../validation.ts';
import type { UnsupportedChars } from '../values.ts';
import type { StepId } from './ids.ts';
import type { PageSpec } from './pages.ts';

export type Update = (recipe: (s: DepositComplaintState) => DepositComplaintState) => void;

export interface StepProps {
  state: DepositComplaintState;
  update: Update;
  /** `fromReview` starts an edit: the page shows "Save and return to review". */
  goTo: (id: StepId, opts?: { fromReview?: boolean }) => void;
  next: () => void;
  /** Characters the form can't print, per field (live). */
  unsupported: readonly UnsupportedChars[];
  /** Soft warnings for the current state (§6.3). */
  warnings: readonly Issue[];
  /** The "answer to continue" error's element id while it's shown, for aria-describedby. */
  pageError: string | null;
  /** Unanswered pages an edit revealed (the Review edit detour interstitial). */
  detourCount: number;
}

export interface PageDef extends PageSpec {
  /** The page's h1, rendered by the shell. Absent when the question itself is the h1. */
  title?: string;
  Component: FunctionComponent<StepProps>;
  /** The page has its own primary action instead of Continue (Back stays). */
  hideNext?: boolean;
}
