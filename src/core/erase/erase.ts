// The erase routine (CLAUDE.md §9.3), used by every entry point. Its effects
// come in as dependencies, so tests run it against fakes.
//
// Order matters: other tabs are told and saving stops first, so no write can
// land after the data is gone; history goes back to the base entry before the
// page is replaced, so no history entry can bring back a filled-in page.

import { clearPrefixed, type KeyValueStorage } from '../storage/draft-store.ts';
import type { DeleteOutcome } from '../storage/idb-store.ts';
import type { TabChannel } from './tabs.ts';

export type EraseFrom = 'header' | 'confirmation' | 'start_over';

/** sessionStorage key (after the prefix) marking "erased; verify on the next load". */
export const ERASED_KEY = 'erased';
/** How long to wait for history.back() to land before replacing anyway. */
const POP_WAIT_MS = 300;

let erasedHere = false;

/** True once this page load has erased (the bfcache guard reads it). */
export const erasedThisPage = (): boolean => erasedHere;

export interface EraseDeps {
  prefix: string;
  saver: { stop(): void };
  channel: TabChannel | null;
  session: KeyValueStorage | null;
  /** This tab's database connection; shut so it can't block the delete or reopen. */
  db: { shutdown(): void };
  deleteDb: () => Promise<DeleteOutcome>;
  revokeAll: () => void;
  /** Resets the answers and the upload store, and drops any built packet. */
  reset: () => void;
  /** Whether the current history entry is the base (Welcome) entry. */
  onBaseEntry: () => boolean;
  back: () => void;
  /** Resolves on the next popstate, or after `ms`. */
  waitForPop: (ms: number) => Promise<void>;
  replace: (url: string) => void;
  basePath: string;
}

export async function eraseAll(d: EraseDeps): Promise<DeleteOutcome> {
  // 0. Tell the other tabs, then stop saving here.
  d.channel?.post({ type: 'erase' });
  d.saver.stop();
  // 1. Both backends, whatever the mode.
  clearPrefixed(d.session, d.prefix);
  d.db.shutdown();
  const outcome = await d.deleteDb();
  // 2–3. Object URLs, then the answers and files in memory.
  d.revokeAll();
  d.reset();
  // 4. Back to the base entry, so the filled-in entry is only ever forward
  // (the next load prunes it), then a fresh load.
  if (!d.onBaseEntry()) {
    const popped = d.waitForPop(POP_WAIT_MS);
    d.back();
    await popped;
  }
  try {
    d.session?.setItem(d.prefix + ERASED_KEY, '1');
  } catch {
    // Without the flag the next load just skips the check.
  }
  erasedHere = true;
  d.replace(d.basePath);
  return outcome;
}

/**
 * On the load after an erase: confirm the database is gone, retrying the
 * delete once. null when no erase is pending. The flag stays until it passes.
 */
export async function verifyErased(d: {
  prefix: string;
  session: KeyValueStorage | null;
  exists: () => Promise<boolean>;
  deleteDb: () => Promise<DeleteOutcome>;
}): Promise<'erased' | 'failed' | null> {
  const key = d.prefix + ERASED_KEY;
  let pending = false;
  try {
    pending = d.session?.getItem(key) === '1';
  } catch {
    pending = false;
  }
  if (!pending) return null;
  let gone = !(await d.exists().catch(() => true));
  if (!gone) gone = (await d.deleteDb()) === 'deleted';
  if (!gone) return 'failed';
  try {
    d.session?.removeItem(key);
  } catch {
    // Checked again next time; harmless.
  }
  return 'erased';
}

/**
 * Another tab erased (its message, or our database being deleted). Runs once
 * per page load: stop saving first, then clear this tab's own copies. The
 * caller shows Welcome with the "erased from another tab" notice; showing
 * Welcome takes history back to the base entry (history.ts), so this tab's
 * Back/Forward can't reach a filled-in page either.
 */
export function createRemoteEraseHandler(d: {
  prefix: string;
  saver: { stop(): void };
  session: KeyValueStorage | null;
  db: { shutdown(): void };
  revokeAll: () => void;
  reset: () => void;
}): () => boolean {
  let handled = false;
  return () => {
    if (handled) return false;
    handled = true;
    d.saver.stop();
    clearPrefixed(d.session, d.prefix);
    d.db.shutdown();
    d.revokeAll();
    d.reset();
    return true;
  };
}

/**
 * A tab erased from elsewhere has saving stopped for this page load, so
 * starting there first reloads the page (saving then works normally).
 */
export function startOrReload(d: {
  remotelyErased: boolean;
  reload: () => void;
  start: () => void;
}): 'reload' | 'start' {
  if (d.remotelyErased) {
    d.reload();
    return 'reload';
  }
  d.start();
  return 'start';
}

/**
 * If the browser restores an erased page from its back/forward cache, replace
 * it with a fresh load.
 */
export function installBfcacheGuard(basePath: string): void {
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && erasedHere) location.replace(basePath);
  });
}
