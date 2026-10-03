// What this form saves as a draft (CLAUDE.md §9.2), and how a saved draft is
// read back. The signature is never saved: none of `signature` (drawn image,
// typed name, method, date, "I have read") survives a save.
//
// Storage ids come from the form, not the app name, so renaming the app never
// orphans saved drafts.

import type { LoadedDraft } from '../../core/storage/idb-store.ts';
import {
  emptyUploads,
  fromStored,
  type UploadedFile,
  type UploadState,
} from '../../core/uploads/store.ts';
import { SLOT_IDS, type SlotId } from './checklist.ts';
import { type DepositComplaintState, initialState } from './schema.ts';
import { normalizeGates } from './situation.ts';
import { STEP_IDS, type StepId } from './steps/ids.ts';
import type { SlotUploads } from './uploads.ts';

export const STORAGE_PREFIX = 'security-deposit-complaint:';
export const SESSION_DRAFT_KEY = `${STORAGE_PREFIX}draft`;
export const DB_NAME = 'security-deposit-complaint-drafts';

type State = DepositComplaintState;

/** What the app is showing when it saves. */
export interface Snapshot {
  state: State;
  uploads: SlotUploads;
  page: StepId;
}

/** The answers as saved: `savedAt` set, the signature reset to its initial values. */
export function serializeState(state: State, savedAt: string): State {
  return {
    ...state,
    meta: { ...state.meta, savedAt },
    signature: initialState().signature,
  };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * `raw` shaped like `defaults`: keys missing from `raw` take the default,
 * keys `defaults` doesn't have are dropped, and a value of the wrong kind
 * (object where a scalar belongs, and so on) falls back to the default.
 */
export function fillDefaults<T>(defaults: T, raw: unknown): T {
  if (isPlainObject(defaults)) {
    const source = isPlainObject(raw) ? raw : {};
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(defaults))
      out[key] = fillDefaults(value, source[key]);
    return out as T;
  }
  if (raw === undefined) return defaults;
  if (Array.isArray(defaults)) return (Array.isArray(raw) ? raw : defaults) as T;
  if (defaults === null) return (isPlainObject(raw) || Array.isArray(raw) ? null : raw) as T;
  return (typeof raw === typeof defaults ? raw : defaults) as T;
}

/** A saved state, or null if it isn't one this version of the form can read. */
export function parseState(raw: unknown): State | null {
  if (!isPlainObject(raw) || !isPlainObject(raw.meta)) return null;
  const initial = initialState();
  const { meta } = raw;
  if (
    meta.formId !== initial.meta.formId ||
    meta.schemaVersion !== initial.meta.schemaVersion ||
    meta.formRevision !== initial.meta.formRevision
  ) {
    return null;
  }
  const state = fillDefaults(initial, raw);
  // Never restored, whatever a stored draft contains.
  state.signature = initial.signature;
  return normalizeGates(state);
}

const parsePage = (raw: unknown): StepId =>
  (STEP_IDS as readonly unknown[]).includes(raw) ? (raw as StepId) : 'welcome';

const isSlotId = (raw: string): raw is SlotId => (SLOT_IDS as readonly string[]).includes(raw);

// Session mode: the answers, and how many files each slot had (never names or
// contents), so a reload can list the slots to add files to again.

export interface SessionDraft {
  state: State;
  page: StepId;
  filesBySlot: Partial<Record<SlotId, number>>;
}

export function sessionDraft(snapshot: Snapshot, savedAt: string): SessionDraft {
  const filesBySlot: Partial<Record<SlotId, number>> = {};
  for (const [slot, files] of Object.entries(snapshot.uploads.files) as [SlotId, unknown[]][]) {
    if (files.length) filesBySlot[slot] = files.length;
  }
  return { state: serializeState(snapshot.state, savedAt), page: snapshot.page, filesBySlot };
}

export function parseSessionDraft(raw: unknown): SessionDraft | null {
  if (!isPlainObject(raw)) return null;
  const state = parseState(raw.state);
  if (!state) return null;
  const filesBySlot: Partial<Record<SlotId, number>> = {};
  if (isPlainObject(raw.filesBySlot)) {
    for (const [slot, count] of Object.entries(raw.filesBySlot)) {
      if (isSlotId(slot) && typeof count === 'number' && count > 0) filesBySlot[slot] = count;
    }
  }
  return { state, page: parsePage(raw.page), filesBySlot };
}

// Device mode: the answers and the slot order in one record; each file (both
// image versions) under its id in the files store.

export interface DeviceRecord {
  state: State;
  page: StepId;
  slots: Partial<Record<SlotId, string[]>>;
  grayscale: Partial<Record<SlotId, boolean>>;
}

export function deviceDraft(
  snapshot: Snapshot,
  savedAt: string,
): { record: DeviceRecord; files: Map<string, UploadedFile> } {
  const slots: Partial<Record<SlotId, string[]>> = {};
  const files = new Map<string, UploadedFile>();
  for (const [slot, list] of Object.entries(snapshot.uploads.files) as [SlotId, UploadedFile[]][]) {
    slots[slot] = list.map((f) => f.id);
    for (const file of list) files.set(file.id, file);
  }
  return {
    record: {
      state: serializeState(snapshot.state, savedAt),
      page: snapshot.page,
      slots,
      grayscale: { ...snapshot.uploads.grayscale },
    },
    files,
  };
}

export function parseDeviceRecord(raw: unknown): DeviceRecord | null {
  if (!isPlainObject(raw)) return null;
  const state = parseState(raw.state);
  if (!state) return null;
  const slots: Partial<Record<SlotId, string[]>> = {};
  if (isPlainObject(raw.slots)) {
    for (const [slot, ids] of Object.entries(raw.slots)) {
      if (isSlotId(slot) && Array.isArray(ids)) {
        slots[slot] = ids.filter((id): id is string => typeof id === 'string');
      }
    }
  }
  const grayscale: Partial<Record<SlotId, boolean>> = {};
  if (isPlainObject(raw.grayscale)) {
    for (const [slot, gray] of Object.entries(raw.grayscale)) {
      if (isSlotId(slot) && typeof gray === 'boolean') grayscale[slot] = gray;
    }
  }
  return { state, page: parsePage(raw.page), slots, grayscale };
}

/**
 * The upload store from a device draft. Each image gets a new thumbnail URL
 * (registered in blob-urls.ts). Files that don't read back are left out.
 */
export function restoreUploads(record: DeviceRecord, loaded: LoadedDraft['files']): SlotUploads {
  const uploads: UploadState<SlotId> = { ...emptyUploads<SlotId>(), grayscale: record.grayscale };
  for (const [slot, ids] of Object.entries(record.slots) as [SlotId, string[]][]) {
    const files = ids.flatMap((id) => {
      const file = fromStored(loaded.get(id));
      return file && file.id === id ? [file] : [];
    });
    if (files.length) uploads.files[slot] = files;
  }
  return uploads;
}

/** Every file in the store by id (what a device save writes). */
export function filesById(uploads: SlotUploads): Map<string, UploadedFile> {
  return new Map(Object.values(uploads.files).flatMap((list) => list.map((f) => [f.id, f])));
}
