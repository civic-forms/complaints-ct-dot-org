// In-memory stand-ins for browser storage, BroadcastChannel, and IndexedDB
// delete requests, so storage and erase logic runs in Node.

import type { TabChannel, TabMessage } from '../../src/core/erase/tabs.ts';
import type { KeyValueStorage } from '../../src/core/storage/draft-store.ts';

/** A Map-backed sessionStorage. */
export class MemoryStorage implements KeyValueStorage {
  readonly map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

/** Tabs on one channel. Like BroadcastChannel, a tab never hears its own posts. */
export function channelHub() {
  const members = new Set<Set<(m: TabMessage) => void>>();
  return {
    connect(): TabChannel {
      const listeners = new Set<(m: TabMessage) => void>();
      members.add(listeners);
      return {
        post(message) {
          for (const other of members) {
            if (other !== listeners) for (const listener of [...other]) listener(message);
          }
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        close() {
          members.delete(listeners);
        },
      };
    },
  };
}

type DeleteEvent = 'success' | 'error' | 'blocked' | 'nothing';

/** An IDBFactory whose deleteDatabase answers with `events`, one per call, in order. */
export function fakeIdb(opts: { exists: boolean; deletes: DeleteEvent[] }) {
  const calls: string[] = [];
  let exists = opts.exists;
  const deletes = [...opts.deletes];
  const factory = {
    databases: async () =>
      exists ? [{ name: 'security-deposit-complaint-drafts', version: 1 }] : [],
    deleteDatabase(name: string) {
      calls.push(name);
      const event = deletes.shift() ?? 'success';
      const request: Record<string, (() => void) | null> = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };
      queueMicrotask(() => {
        if (event === 'success') exists = false;
        if (event !== 'nothing') request[`on${event}`]?.();
      });
      return request;
    },
    open() {
      throw new Error('not used');
    },
  };
  return { factory: factory as unknown as IDBFactory, calls };
}
