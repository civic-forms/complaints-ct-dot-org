// Erase (CLAUDE.md §9.3): the routine's order, the check on the next load,
// and erase across tabs (counting them first, and what a receiving tab does).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDrafts } from '../../src/app/drafts.ts';
import {
  createRemoteEraseHandler,
  ERASED_KEY,
  eraseAll,
  startOrReload,
  verifyErased,
} from '../../src/core/erase/erase.ts';
import {
  countTabs,
  listenToTabs,
  otherTabsLine,
  parseMessage,
  prepareEraseDialog,
  type TabMessage,
} from '../../src/core/erase/tabs.ts';
import { createSaver } from '../../src/core/storage/saver.ts';
import { emptyUploads } from '../../src/core/uploads/store.ts';
import {
  SESSION_DRAFT_KEY,
  STORAGE_PREFIX,
} from '../../src/forms/ct-dob-security-deposit/draft.ts';
import { type23AllYes } from '../fixtures/states.ts';
import { channelHub, fakeIdb, MemoryStorage } from '../helpers/fakes.ts';

const FLAG = STORAGE_PREFIX + ERASED_KEY;

afterEach(() => {
  vi.useRealTimers();
});

function eraseDeps(opts: { onBase: boolean; session?: MemoryStorage }) {
  const log: string[] = [];
  const session = opts.session ?? new MemoryStorage();
  return {
    log,
    session,
    deps: {
      prefix: STORAGE_PREFIX,
      saver: { stop: () => log.push('stop saving') },
      channel: {
        post: (m: TabMessage) => log.push(`post ${m.type}`),
        subscribe: () => () => {},
        close() {},
      },
      session,
      db: { shutdown: () => log.push('close db') },
      deleteDb: async () => {
        log.push('delete db');
        return 'deleted' as const;
      },
      revokeAll: () => log.push('revoke urls'),
      reset: () => log.push('reset'),
      backToBase: async () => {
        if (!opts.onBase) log.push('back to welcome');
      },
      replace: (url: string) => log.push(`replace ${url}`),
      basePath: '/base/',
    },
  };
}

describe('the erase routine', () => {
  it('tells other tabs and stops saving first, and goes back before replacing', async () => {
    const session = new MemoryStorage();
    session.setItem(SESSION_DRAFT_KEY, '{}');
    session.setItem('another-tool:x', 'kept');
    const { deps, log } = eraseDeps({ onBase: false, session });
    await eraseAll(deps);
    expect(log).toEqual([
      'post erase',
      'stop saving',
      'close db',
      'delete db',
      'revoke urls',
      'reset',
      'back to welcome',
      'replace /base/',
    ]);
    // Both backends cleared; only the erased flag (not user data) is left.
    expect(session.getItem(SESSION_DRAFT_KEY)).toBeNull();
    expect(session.getItem(FLAG)).toBe('1');
    expect(session.getItem('another-tool:x')).toBe('kept');
  });

  it('does not go back when already on the base entry', async () => {
    const { deps, log } = eraseDeps({ onBase: true });
    await eraseAll(deps);
    expect(log).not.toContain('back to welcome');
    expect(log.at(-1)).toBe('replace /base/');
  });
});

describe('checking the erase on the next load', () => {
  const check = (
    session: MemoryStorage,
    exists: boolean,
    retry: 'deleted' | 'blocked' | 'failed',
  ) => {
    const deleteDb = vi.fn(async () => retry);
    return {
      deleteDb,
      result: verifyErased({
        prefix: STORAGE_PREFIX,
        session,
        exists: async () => exists,
        deleteDb,
      }),
    };
  };
  const flagged = () => {
    const s = new MemoryStorage();
    s.setItem(FLAG, '1');
    return s;
  };

  it('does nothing without the flag', async () => {
    expect(await check(new MemoryStorage(), true, 'failed').result).toBeNull();
  });

  it('confirms when the database is gone, and removes the flag', async () => {
    const session = flagged();
    const { result, deleteDb } = check(session, false, 'failed');
    expect(await result).toBe('erased');
    expect(deleteDb).not.toHaveBeenCalled();
    expect(session.getItem(FLAG)).toBeNull();
  });

  it('retries the delete once when the database is still there', async () => {
    const session = flagged();
    const { result, deleteDb } = check(session, true, 'deleted');
    expect(await result).toBe('erased');
    expect(deleteDb).toHaveBeenCalledTimes(1);
    expect(session.getItem(FLAG)).toBeNull();
  });

  it('reports a failure, and keeps the flag, when the retry is blocked or fails', async () => {
    for (const outcome of ['blocked', 'failed'] as const) {
      const session = flagged();
      expect(await check(session, true, outcome).result).toBe('failed');
      expect(session.getItem(FLAG)).toBe('1');
    }
  });

  it('loads no draft while the erase is unconfirmed', async () => {
    const session = flagged();
    session.setItem(
      SESSION_DRAFT_KEY,
      JSON.stringify({ state: type23AllYes, page: 'review', filesBySlot: {} }),
    );
    const idb = fakeIdb({ exists: true, deletes: ['blocked'] });
    const drafts = createDrafts({
      session,
      idb: idb.factory,
      onFailure: () => {},
      onRemoteDeleted: () => {},
    });
    expect((await drafts.boot()).kind).toBe('eraseFailed');
    expect(idb.calls).toHaveLength(1);

    const retried = fakeIdb({ exists: true, deletes: ['success'] });
    const again = createDrafts({
      session: flagged(),
      idb: retried.factory,
      onFailure: () => {},
      onRemoteDeleted: () => {},
    });
    expect((await again.boot()).kind).toBe('erased');
  });
});

describe('counting other tabs before the dialog opens', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('counts each tab once, for this ping only', () => {
    const pong = (id: string, from: string): TabMessage => ({ type: 'pong', id, from });
    expect(countTabs([], 'p')).toBe(0);
    expect(countTabs([pong('p', 'a')], 'p')).toBe(1);
    expect(countTabs([pong('p', 'a'), pong('p', 'b'), pong('p', 'a'), pong('q', 'c')], 'p')).toBe(
      2,
    );
  });

  it('picks the line for 0, 1, several, and unknown', () => {
    const copy = { one: 'one', many: (n: number) => `many ${n}`, unknown: 'unknown' };
    expect(otherTabsLine(0, copy)).toBeNull();
    expect(otherTabsLine(1, copy)).toBe('one');
    expect(otherTabsLine(3, copy)).toBe('many 3');
    expect(otherTabsLine('unknown', copy)).toBe('unknown');
  });

  it('opens only after 200 ms, with every answer counted', async () => {
    const hub = channelHub();
    const here = hub.connect();
    const others = [hub.connect(), hub.connect()];
    // The other tabs answer late: one at 50 ms, one at 150 ms.
    for (const [i, tab] of others.entries()) {
      tab.subscribe((m) => {
        if (m.type === 'ping') {
          setTimeout(() => tab.post({ type: 'pong', id: m.id, from: `tab${i}` }), 50 + i * 100);
        }
      });
    }
    const open = vi.fn();
    prepareEraseDialog(here, open);
    await vi.advanceTimersByTimeAsync(199);
    expect(open).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(open).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('opens at once with "unknown" without BroadcastChannel', () => {
    const open = vi.fn();
    prepareEraseDialog(null, open);
    expect(open).toHaveBeenCalledExactlyOnceWith('unknown');
  });

  it('counts real listeners answering pings', async () => {
    const hub = channelHub();
    const here = hub.connect();
    listenToTabs(hub.connect(), 'b', () => {});
    const open = vi.fn();
    prepareEraseDialog(here, open);
    await vi.advanceTimersByTimeAsync(200);
    expect(open).toHaveBeenCalledWith(1);
  });

  it('ignores malformed messages', () => {
    expect(parseMessage({ type: 'pong', id: 'x' })).toBeNull();
    expect(parseMessage({ type: 'erase', extra: 'data' })).toEqual({ type: 'erase' });
    expect(parseMessage('erase')).toBeNull();
  });
});

describe('a tab erased from another tab', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  function secondTab(hub: ReturnType<typeof channelHub>) {
    const session = new MemoryStorage();
    session.setItem(SESSION_DRAFT_KEY, '{"answers":"typed in tab 2"}');
    const write = vi.fn();
    const saver = createSaver({ write });
    const shutdown = vi.fn();
    const revokeAll = vi.fn();
    const reset = vi.fn();
    const handler = createRemoteEraseHandler({
      prefix: STORAGE_PREFIX,
      saver,
      session,
      db: { shutdown },
      revokeAll,
      reset,
    });
    listenToTabs(hub.connect(), 'tab2', handler);
    return { session, write, saver, shutdown, revokeAll, reset, handler };
  }

  it('never writes its pending save after the erase message', async () => {
    const hub = channelHub();
    const tab2 = secondTab(hub);
    tab2.saver.schedule();
    const { deps } = eraseDeps({ onBase: true });
    await eraseAll({ ...deps, channel: hub.connect() });
    await vi.advanceTimersByTimeAsync(5000);
    tab2.saver.schedule();
    await tab2.saver.flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(tab2.write).not.toHaveBeenCalled();
  });

  it('clears its session-mode data, closes its database, and resets once', async () => {
    const hub = channelHub();
    const tab2 = secondTab(hub);
    const { deps } = eraseDeps({ onBase: true });
    await eraseAll({ ...deps, channel: hub.connect() });
    expect(tab2.session.getItem(SESSION_DRAFT_KEY)).toBeNull();
    expect(tab2.shutdown).toHaveBeenCalledTimes(1);
    expect(tab2.revokeAll).toHaveBeenCalledTimes(1);
    expect(tab2.reset).toHaveBeenCalledTimes(1);
    // A second signal (e.g. versionchange as well) does nothing more.
    expect(tab2.handler()).toBe(false);
    expect(tab2.reset).toHaveBeenCalledTimes(1);
  });

  it('reloads instead of starting a form with saving stopped', () => {
    const reload = vi.fn();
    const start = vi.fn();
    expect(startOrReload({ remotelyErased: true, reload, start })).toBe('reload');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
    expect(startOrReload({ remotelyErased: false, reload, start })).toBe('start');
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('its drafts controller never writes after the erase', async () => {
    // A drafts controller whose saver the remote handler stops.
    const session = new MemoryStorage();
    const drafts = createDrafts({
      session,
      idb: null,
      onFailure: () => {},
      onRemoteDeleted: () => {},
    });
    await drafts.start('session', { state: type23AllYes, uploads: emptyUploads(), page: 'review' });
    const hub = channelHub();
    listenToTabs(
      hub.connect(),
      'tab2',
      createRemoteEraseHandler({
        prefix: STORAGE_PREFIX,
        saver: drafts.saver,
        session,
        db: drafts.db,
        revokeAll: () => {},
        reset: () => {},
      }),
    );
    drafts.update({ state: type23AllYes, uploads: emptyUploads(), page: 'send' });
    hub.connect().post({ type: 'erase' });
    await vi.advanceTimersByTimeAsync(5000);
    await drafts.saver.flush();
    expect(session.getItem(SESSION_DRAFT_KEY)).toBeNull();
  });
});
