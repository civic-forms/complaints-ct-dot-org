// What every wizard page receives, and the registry entry shape.

import type { ComponentChildren, FunctionComponent } from 'preact';
import type { EraseFrom } from '../../../core/erase/erase.ts';
import type { DepositComplaintState } from '../schema.ts';
import type { SlotUploads } from '../uploads.ts';
import type { Issue } from '../validation.ts';
import type { UnsupportedChars } from '../values.ts';
import type { StepId } from './ids.ts';
import type { PageSpec } from './pages.ts';

export type Update = (recipe: (s: DepositComplaintState) => DepositComplaintState) => void;
export type UpdateUploads = (recipe: (u: SlotUploads) => SlotUploads) => void;

/** What the app shell does for a page: start, resume, erase (Welcome, Confirmation). */
export interface AppControls {
  /** Welcome's start buttons (§9.1). */
  start: (mode: 'session' | 'device') => void;
  /** Continue a saved draft; null when none was found. */
  resume: (() => void) | null;
  /** The start buttons are hidden (an erase couldn't finish). */
  canStart: boolean;
  /** Counts other tabs, then opens the erase dialog (§9.3). */
  openErase: (from: EraseFrom) => void;
  /** True while other tabs are being counted, before the dialog opens. */
  erasePending: boolean;
  /** App notices Welcome shows under its heading (erased, expired, …). */
  notices: ComponentChildren;
}

export interface StepProps {
  state: DepositComplaintState;
  update: Update;
  /** Uploaded files by slot (§8.4): one store, so a slot on two pages is one slot. */
  uploads: SlotUploads;
  updateUploads: UpdateUploads;
  /** `fromReview` starts an edit: the page shows "Save and return to review". */
  goTo: (id: StepId, opts?: { fromReview?: boolean }) => void;
  next: () => void;
  /** Characters the form can't print, per field (live). */
  unsupported: readonly UnsupportedChars[];
  /** Soft warnings for the current state (§6.3). */
  warnings: readonly Issue[];
  /** The "answer to continue" error's element id while it's shown, for aria-describedby. */
  pageError: string | null;
  app: AppControls;
}

export interface PageDef extends PageSpec {
  /** The page's h1, rendered by the shell. Absent when the question itself is the h1. */
  title?: string;
  Component: FunctionComponent<StepProps>;
  /** The page has its own primary action instead of Continue (Back stays). */
  hideNext?: boolean;
}
