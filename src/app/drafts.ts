// Saving and loading drafts for the app (CLAUDE.md §9.2): the chosen mode's
// backend, the debounced saver, and what the app finds on load. Storage
// failures never throw out of here: saving switches to memory only and the
// app is told once.

import { verifyErased } from '../core/erase/erase.ts';
import {
  clearPrefixed,
  type KeyValueStorage,
  storageFailure,
} from '../core/storage/draft-store.ts';
import { isExpired } from '../core/storage/expiry.ts';
import { createIdbStore, deleteDatabase } from '../core/storage/idb-store.ts';
import { createSaver } from '../core/storage/saver.ts';
import { createSessionStore } from '../core/storage/session-store.ts';
import { toStored, type UploadedFile } from '../core/uploads/store.ts';
import type { SlotId } from '../forms/ct-dob-security-deposit/checklist.ts';
import {
  DB_NAME,
  deviceDraft,
  filesById,
  parseDeviceRecord,
  parseSessionDraft,
  restoreUploads,
  SESSION_DRAFT_KEY,
  type Snapshot,
  STORAGE_PREFIX,
  sessionDraft,
} from '../forms/ct-dob-security-deposit/draft.ts';

export type Mode = 'session' | 'device';
export type Failure = 'quota' | 'unavailable';

export type BootResult =
  | { kind: 'none' }
  | { kind: 'expired' }
  | { kind: 'erased' }
  | { kind: 'eraseFailed' }
  | {
      kind: 'found';
      mode: Mode;
      snapshot: Snapshot;
      /** Session mode: slots that had files before the reload (files aren't kept). */
      filesToReadd: SlotId[];
    };

export interface DraftsDeps {
  session: KeyValueStorage | null;
  idb: IDBFactory | null;
  now?: () => Date;
  /** Saving failed; the app now keeps everything in memory only. */
  onFailure: (failure: Failure) => void;
  /** Another tab deleted the database (it erased). */
  onRemoteDeleted: () => void;
}

export function createDrafts({
  session,
  idb,
  now = () => new Date(),
  onFailure,
  onRemoteDeleted,
}: DraftsDeps) {
  const db = createIdbStore<UploadedFile>({
    factory: idb,
    name: DB_NAME,
    toValue: toStored,
    onDeleted: onRemoteDeleted,
  });
  const sessionStore = session
    ? createSessionStore(session, SESSION_DRAFT_KEY, parseSessionDraft)
    : null;
  let mode: Mode | null = null;
  let latest: Snapshot | null = null;

  const write = async () => {
    const snapshot = latest;
    const target = mode;
    if (!snapshot || !target) return;
    const savedAt = now().toISOString();
    if (target === 'session') {
      if (!sessionStore) throw new DOMException('No session storage', 'SecurityError');
      await sessionStore.save(sessionDraft(snapshot, savedAt));
    } else {
      const { record, files } = deviceDraft(snapshot, savedAt);
      await db.save(record, files);
    }
  };

  const fail = (error: unknown) => {
    if (saver.stopped) return;
    const failed = mode;
    mode = null;
    // Memory only from here: don't leave a partial copy behind.
    if (failed === 'session') void sessionStore?.clear().catch(() => {});
    if (failed === 'device') void db.empty().catch(() => {});
    onFailure(storageFailure(error));
  };

  const saver = createSaver({ write, onError: fail });

  return {
    saver,
    db,
    get mode() {
      return mode;
    },

    /** The app's current data; saved after the debounce once a mode is chosen. */
    update(snapshot: Snapshot) {
      latest = snapshot;
      if (mode) saver.schedule();
    },

    /** Starts saving (Welcome's start buttons, or Continue on a found draft). */
    async start(next: Mode, snapshot: Snapshot) {
      mode = next;
      latest = snapshot;
      await saver.flush();
    },

    /** The header's switch. Leaving device mode removes the device copy at once. */
    async switchMode(next: Mode) {
      const previous = mode;
      mode = next;
      if (previous === 'device' && next === 'session') await db.empty().catch(() => {});
      if (previous === 'session' && next === 'device') {
        // Boot reads session drafts first, so this one must go.
        await sessionStore?.clear().catch(() => {});
      }
      await saver.flush();
    },

    /** What's saved, if anything. Expired drafts are cleared here. */
    async boot(): Promise<BootResult> {
      const verified = await verifyErased({
        prefix: STORAGE_PREFIX,
        session,
        exists: () => db.exists(),
        deleteDb: () => deleteDatabase(idb, DB_NAME),
      });
      if (verified === 'erased') return { kind: 'erased' };
      if (verified === 'failed') return { kind: 'eraseFailed' };
      const time = now();

      try {
        const draft = await sessionStore?.load();
        if (draft) {
          if (isExpired(draft.state.meta.savedAt, time)) {
            clearPrefixed(session, STORAGE_PREFIX);
            return { kind: 'expired' };
          }
          return {
            kind: 'found',
            mode: 'session',
            snapshot: {
              state: draft.state,
              uploads: { files: {}, grayscale: {} },
              page: draft.page,
            },
            filesToReadd: Object.keys(draft.filesBySlot) as SlotId[],
          };
        }
      } catch {
        // Unreadable session storage holds nothing we can use.
      }

      try {
        if (!(await db.exists())) return { kind: 'none' };
        const loaded = await db.load();
        const record = loaded ? parseDeviceRecord(loaded.record) : null;
        if (!loaded || !record) {
          db.close();
          return { kind: 'none' };
        }
        if (isExpired(record.state.meta.savedAt, time)) {
          await db.empty();
          db.close();
          return { kind: 'expired' };
        }
        const uploads = restoreUploads(record, loaded.files);
        db.adopt(filesById(uploads));
        return {
          kind: 'found',
          mode: 'device',
          snapshot: { state: record.state, uploads, page: record.page },
          filesToReadd: [],
        };
      } catch {
        db.close();
        return { kind: 'none' };
      }
    },
  };
}

export type Drafts = ReturnType<typeof createDrafts>;
