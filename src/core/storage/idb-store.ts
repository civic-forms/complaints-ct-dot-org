// Device-mode drafts (CLAUDE.md §9.2): IndexedDB holds the answers and the
// uploaded files (Blobs, stored directly). A thin wrapper: the decisions it
// makes are pure functions below (planFileWrites, handleVersionChange,
// deleteDatabase's outcome), tested with fakes; the rest is checked in a browser.
//
// Two object stores: `draft` (one record, key "current") and `files` (one
// entry per file id). A save writes the record and only the files that changed.
// Deleting the whole database is for erase only (§9.3); see `empty`.

export type DeleteOutcome = 'deleted' | 'blocked' | 'failed';

const DRAFT = 'draft';
const FILES = 'files';
const RECORD_KEY = 'current';
const VERSION = 1;
/** No success, error, or blocked event by then counts as blocked. */
const DELETE_TIMEOUT_MS = 1000;

export interface LoadedDraft {
  record: unknown;
  files: Map<string, unknown>;
}

export interface IdbStore<T> {
  /** Whether the database exists, without creating it. */
  exists(): Promise<boolean>;
  load(): Promise<LoadedDraft | null>;
  /** Marks files as already saved (after restoring a loaded draft). */
  adopt(files: ReadonlyMap<string, T>): void;
  save(record: unknown, files: ReadonlyMap<string, T>): Promise<void>;
  /**
   * Removes the saved draft and files but keeps the (empty) database. Only
   * erase deletes the database itself, because other tabs read a delete as
   * "another tab erased" (handleVersionChange).
   */
  empty(): Promise<void>;
  close(): void;
  /** Closes, and refuses to open again until the next page load (erase). */
  shutdown(): void;
}

/**
 * Which files a save must write or delete. A file is written when its id is
 * new or its object changed (the upload store replaces a file's object when its
 * contents change, e.g. "Compress more"), and deleted when its id is gone.
 */
export function planFileWrites<T>(
  lastSaved: ReadonlyMap<string, T>,
  current: ReadonlyMap<string, T>,
): { put: string[]; del: string[] } {
  const put = [...current].filter(([id, file]) => lastSaved.get(id) !== file).map(([id]) => id);
  const del = [...lastSaved.keys()].filter((id) => !current.has(id));
  return { put, del };
}

/**
 * Another tab is deleting or upgrading the database: let go of it so we never
 * block that. A delete (`newVersion === null`) means another tab erased (§9.3).
 */
export function handleVersionChange(
  event: { newVersion: number | null },
  db: { close(): void },
  onClosed: () => void,
  onDeleted?: () => void,
): void {
  db.close();
  onClosed();
  if (event.newVersion === null) onDeleted?.();
}

/**
 * Deletes a database. `blocked` (another tab still holds a connection) is an
 * outcome of its own: the request stays pending and completes if that tab
 * lets go, but the caller can't count on it.
 */
export function deleteDatabase(
  factory: Pick<IDBFactory, 'deleteDatabase'> | null,
  name: string,
  timeoutMs = DELETE_TIMEOUT_MS,
): Promise<DeleteOutcome> {
  if (!factory) return Promise.resolve('deleted');
  return new Promise((resolve) => {
    let settled = false;
    const finish = (outcome: DeleteOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(outcome);
    };
    const timer = setTimeout(() => finish('blocked'), timeoutMs);
    try {
      const request = factory.deleteDatabase(name);
      request.onsuccess = () => finish('deleted');
      request.onerror = () => finish('failed');
      request.onblocked = () => finish('blocked');
    } catch {
      finish('failed');
    }
  });
}

/** `window.indexedDB`, or null where it's missing or reading it throws. */
export function indexedDbOrNull(): IDBFactory | null {
  try {
    return typeof indexedDB === 'undefined' ? null : indexedDB;
  } catch {
    return null;
  }
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
  });

const result = <R>(request: IDBRequest<R>) =>
  new Promise<R>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export function createIdbStore<T>({
  factory,
  name,
  toValue,
  onDeleted,
}: {
  factory: IDBFactory | null;
  name: string;
  /** What goes into the `files` store for one file (structured-cloneable). */
  toValue: (file: T) => unknown;
  /** Another tab deleted the database (erase, §9.3). */
  onDeleted?: () => void;
}): IdbStore<T> {
  let db: IDBDatabase | null = null;
  let opening: Promise<IDBDatabase> | null = null;
  let shutDown = false;
  let lastSaved: ReadonlyMap<string, T> = new Map();

  const forget = () => {
    db = null;
    opening = null;
  };

  const open = (): Promise<IDBDatabase> => {
    if (shutDown || !factory) return Promise.reject(new Error('Storage is closed'));
    if (db) return Promise.resolve(db);
    opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(name, VERSION);
      request.onupgradeneeded = () => {
        const upgrading = request.result;
        if (!upgrading.objectStoreNames.contains(DRAFT)) upgrading.createObjectStore(DRAFT);
        if (!upgrading.objectStoreNames.contains(FILES)) upgrading.createObjectStore(FILES);
      };
      request.onsuccess = () => {
        const opened = request.result;
        if (shutDown) {
          opened.close();
          reject(new Error('Storage is closed'));
          return;
        }
        opened.onversionchange = (event) =>
          handleVersionChange(event, opened, forget, () => {
            lastSaved = new Map();
            onDeleted?.();
          });
        opened.onclose = forget;
        db = opened;
        resolve(opened);
      };
      request.onerror = () => {
        opening = null;
        reject(request.error);
      };
    });
    return opening;
  };

  const close = () => {
    db?.close();
    forget();
  };

  async function exists(): Promise<boolean> {
    if (!factory) return false;
    if (typeof factory.databases === 'function') {
      try {
        return (await factory.databases()).some((info) => info.name === name);
      } catch {
        // Fall through to the open check.
      }
    }
    // Open without a version: a missing database gets an upgrade, which we
    // abort, so it is never created.
    return new Promise((resolve) => {
      let created = false;
      const request = factory.open(name);
      request.onupgradeneeded = () => {
        created = true;
        request.transaction?.abort();
      };
      request.onsuccess = () => {
        request.result.close();
        resolve(!created);
      };
      request.onerror = (event) => {
        event.preventDefault();
        resolve(false);
      };
    });
  }

  return {
    exists,

    async load() {
      const opened = await open();
      const tx = opened.transaction([DRAFT, FILES], 'readonly');
      const [record, keys, values] = await Promise.all([
        result(tx.objectStore(DRAFT).get(RECORD_KEY)),
        result(tx.objectStore(FILES).getAllKeys()),
        result(tx.objectStore(FILES).getAll()),
      ]);
      if (record === undefined) return null;
      const files = new Map<string, unknown>();
      keys.forEach((key, i) => {
        if (typeof key === 'string') files.set(key, values[i]);
      });
      return { record, files };
    },

    adopt(files) {
      lastSaved = new Map(files);
    },

    async save(record, files) {
      const { put, del } = planFileWrites(lastSaved, files);
      const opened = await open();
      const tx = opened.transaction([DRAFT, FILES], 'readwrite');
      tx.objectStore(DRAFT).put(record, RECORD_KEY);
      const store = tx.objectStore(FILES);
      for (const id of put) {
        const file = files.get(id);
        if (file !== undefined) store.put(toValue(file), id);
      }
      for (const id of del) store.delete(id);
      await done(tx);
      lastSaved = new Map(files);
    },

    async empty() {
      lastSaved = new Map();
      // Never creates the database just to empty it.
      if (!(await exists())) return;
      const opened = await open();
      const tx = opened.transaction([DRAFT, FILES], 'readwrite');
      tx.objectStore(DRAFT).clear();
      tx.objectStore(FILES).clear();
      await done(tx);
    },

    close,

    shutdown() {
      shutDown = true;
      close();
    },
  };
}
