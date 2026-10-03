// Draft storage (CLAUDE.md §9.2). Two backends: sessionStorage (text only, this
// tab) and IndexedDB (text plus files, this device). Every call can fail
// (private browsing, a full disk, storage turned off); callers catch and fall
// back to memory only.

export interface DraftStore<D> {
  load(): Promise<D | null>;
  /** Debounced by the caller (~500 ms, see saver.ts). */
  save(draft: D): Promise<void>;
  clear(): Promise<void>;
}

/** The subset of `Storage` the app uses, so tests can pass a Map-backed fake. */
export type KeyValueStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'
>;

/** Why a save failed, for the notice (and Phase 6 telemetry: storage_quota / storage_unavailable). */
export function storageFailure(error: unknown): 'quota' | 'unavailable' {
  const name = (error as { name?: unknown } | null)?.name;
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
    ? 'quota'
    : 'unavailable';
}

/** Removes every key that starts with `prefix` (erase, §9.3). Never throws. */
export function clearPrefixed(storage: KeyValueStorage | null, prefix: string): void {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Storage that can't be read holds nothing of ours.
  }
}

/** `window.sessionStorage`, or null where reading it throws (e.g. storage blocked). */
export function sessionStorageOrNull(): KeyValueStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}
