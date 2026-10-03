// Session-mode drafts (CLAUDE.md §9.2): the answers as JSON under one key in
// sessionStorage, so they survive a reload of this tab and nothing else. Files
// are never stored here.

import type { DraftStore, KeyValueStorage } from './draft-store.ts';

export function createSessionStore<D>(
  storage: KeyValueStorage,
  key: string,
  /** Checks a stored value; returns null to discard it. */
  parse: (raw: unknown) => D | null,
): DraftStore<D> {
  return {
    async load() {
      const raw = storage.getItem(key);
      if (raw === null) return null;
      try {
        return parse(JSON.parse(raw));
      } catch {
        return null;
      }
    },
    async save(draft) {
      storage.setItem(key, JSON.stringify(draft));
    },
    async clear() {
      storage.removeItem(key);
    },
  };
}
