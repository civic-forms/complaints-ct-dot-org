// Drafts (CLAUDE.md §9.2): what is saved, what is never saved, how a saved
// draft is read back, expiry, the debounced saver, and the device-mode file diff.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDrafts } from '../../src/app/drafts.ts';
import { revokeAllObjectUrls } from '../../src/core/blob-urls.ts';
import { clearPrefixed, storageFailure } from '../../src/core/storage/draft-store.ts';
import { isExpired } from '../../src/core/storage/expiry.ts';
import {
  deleteDatabase,
  handleVersionChange,
  planFileWrites,
} from '../../src/core/storage/idb-store.ts';
import { createSaver } from '../../src/core/storage/saver.ts';
import { createSessionStore } from '../../src/core/storage/session-store.ts';
import {
  addFiles,
  emptyUploads,
  fromStored,
  toStored,
  type UploadedFile,
} from '../../src/core/uploads/store.ts';
import type { SlotId } from '../../src/forms/ct-dob-security-deposit/checklist.ts';
import {
  deviceDraft,
  fillDefaults,
  parseDeviceRecord,
  parseSessionDraft,
  parseState,
  restoreUploads,
  SESSION_DRAFT_KEY,
  type Snapshot,
  STORAGE_PREFIX,
  serializeState,
  sessionDraft,
} from '../../src/forms/ct-dob-security-deposit/draft.ts';
import { initialState } from '../../src/forms/ct-dob-security-deposit/schema.ts';
import { type23AllYes } from '../fixtures/states.ts';
import { fakeIdb, MemoryStorage } from '../helpers/fakes.ts';

const NOW = new Date('2026-10-03T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

function signed() {
  const s = structuredClone(type23AllYes);
  s.signature = {
    method: 'typed',
    pngDataUrl: 'data:image/png;base64,AAAA',
    typedName: 'Jordan Example',
    signedDate: '2026-10-03',
    statementsRead: true,
  };
  return s;
}

const image = (id: string, name = `${id}.jpg`): UploadedFile => ({
  kind: 'image',
  id,
  name,
  pages: 1,
  color: new Blob(['color']),
  gray: new Blob(['gray']),
  thumbUrl: `blob:thumb-${id}`,
  preset: 'standard',
});
const pdf = (id: string): UploadedFile => ({
  kind: 'pdf',
  id,
  name: `${id}.pdf`,
  pages: 3,
  pdf: new Blob(['%PDF']),
});

afterEach(() => {
  revokeAllObjectUrls();
  vi.useRealTimers();
});

describe('what a draft holds', () => {
  it('never saves anything in signature', () => {
    const saved = serializeState(signed(), NOW.toISOString());
    expect(saved.signature).toEqual(initialState().signature);
    expect(saved.meta.savedAt).toBe(NOW.toISOString());
    // And a stored draft that somehow contains one doesn't bring it back.
    const raw = JSON.parse(JSON.stringify(signed()));
    expect(parseState(raw)?.signature).toEqual(initialState().signature);
    const json = JSON.stringify(
      sessionDraft({ state: signed(), uploads: emptyUploads(), page: 'send' }, ''),
    );
    for (const secret of ['Jordan Example', 'AAAA', '2026-10-03'])
      expect(json).not.toContain(secret);
  });

  it('keeps file counts in session mode, never file names or contents', () => {
    let uploads = emptyUploads<SlotId>();
    uploads = addFiles(uploads, 'depositProof', [image('a', 'my-receipt.jpg'), image('b')]);
    uploads = addFiles(uploads, 'other', []);
    const draft = sessionDraft({ state: type23AllYes, uploads, page: 'documents.other' }, '');
    expect(draft.filesBySlot).toEqual({ depositProof: 2 });
    expect(JSON.stringify(draft)).not.toContain('my-receipt');
    const back = parseSessionDraft(JSON.parse(JSON.stringify(draft)));
    expect(back?.filesBySlot).toEqual({ depositProof: 2 });
    expect(back?.page).toBe('documents.other');
  });
});

describe('reading a draft back', () => {
  it('rejects anything that is not this form’s state', () => {
    for (const raw of [null, 'x', 1, [], {}, { meta: {} }]) expect(parseState(raw)).toBeNull();
    const other = structuredClone(initialState()) as unknown as { meta: Record<string, unknown> };
    other.meta.formId = 'something-else';
    expect(parseState(other)).toBeNull();
    const older = structuredClone(initialState()) as unknown as { meta: Record<string, unknown> };
    older.meta.schemaVersion = 0;
    expect(parseState(older)).toBeNull();
    expect(parseSessionDraft({ state: 'nope', page: 'welcome' })).toBeNull();
  });

  it('fills missing keys from the initial state and drops unknown ones', () => {
    const raw = JSON.parse(JSON.stringify(type23AllYes));
    delete raw.tenant.streetLine2;
    delete raw.questions.roommates;
    raw.tenant.removedField = 'x';
    raw.rental.monthlyRentCents = { wrong: 'kind' };
    const state = parseState(raw);
    expect(state?.tenant.streetLine2).toBe('');
    expect(state?.questions.roommates).toEqual(initialState().questions.roommates);
    expect(state?.tenant).not.toHaveProperty('removedField');
    expect(state?.rental.monthlyRentCents).toBeNull();
    expect(state?.tenant.name).toBe(type23AllYes.tenant.name);
  });

  it('keeps arrays and nulls from the draft', () => {
    expect(
      fillDefaults({ a: [] as string[], b: null as string | null }, { a: ['x'], b: 'y' }),
    ).toEqual({ a: ['x'], b: 'y' });
    expect(fillDefaults({ a: [] as string[] }, { a: 'not a list' })).toEqual({ a: [] });
  });

  it('falls back to Welcome for an unknown page', () => {
    const draft = sessionDraft(
      { state: type23AllYes, uploads: emptyUploads(), page: 'review' },
      '',
    );
    const raw = { ...JSON.parse(JSON.stringify(draft)), page: 'no.such.page' };
    expect(parseSessionDraft(raw)?.page).toBe('welcome');
  });
});

describe('30-day expiry', () => {
  it('keeps a draft up to 30 days old and clears one older', () => {
    expect(isExpired(ago(29), NOW)).toBe(false);
    expect(isExpired(ago(30), NOW)).toBe(false);
    expect(isExpired(ago(31), NOW)).toBe(true);
    expect(isExpired(null, NOW)).toBe(true);
    expect(isExpired('not a date', NOW)).toBe(true);
  });
});

describe('session store', () => {
  it('saves, loads, and clears one key', async () => {
    const storage = new MemoryStorage();
    const store = createSessionStore(storage, 'k', (raw) => (typeof raw === 'object' ? raw : null));
    expect(await store.load()).toBeNull();
    await store.save({ a: 1 });
    expect(await store.load()).toEqual({ a: 1 });
    storage.setItem('k', '{not json');
    expect(await store.load()).toBeNull();
    await store.clear();
    expect(storage.getItem('k')).toBeNull();
  });

  it('clears only keys with the prefix', () => {
    const storage = new MemoryStorage();
    storage.setItem(`${STORAGE_PREFIX}draft`, '1');
    storage.setItem(`${STORAGE_PREFIX}erased`, '1');
    storage.setItem('another-tool:draft', '1');
    clearPrefixed(storage, STORAGE_PREFIX);
    expect([...storage.map.keys()]).toEqual(['another-tool:draft']);
  });

  it('names quota failures', () => {
    expect(storageFailure(new DOMException('full', 'QuotaExceededError'))).toBe('quota');
    expect(storageFailure(new DOMException('no', 'SecurityError'))).toBe('unavailable');
    expect(storageFailure(null)).toBe('unavailable');
  });
});

describe('the saver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('writes once, 500 ms after the last change', async () => {
    const write = vi.fn();
    const saver = createSaver({ write });
    saver.schedule();
    await vi.advanceTimersByTimeAsync(300);
    saver.schedule();
    await vi.advanceTimersByTimeAsync(499);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('a save scheduled just before erase never writes after it', async () => {
    const write = vi.fn();
    const saver = createSaver({ write });
    saver.schedule();
    saver.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(write).not.toHaveBeenCalled();
  });

  it('writes nothing after stop, including the pagehide flush', async () => {
    const write = vi.fn();
    const saver = createSaver({ write });
    saver.stop();
    saver.schedule();
    await saver.flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(write).not.toHaveBeenCalled();
    expect(saver.stopped).toBe(true);
  });

  it('drops a write queued behind one in progress when stopped', async () => {
    let finish = () => {};
    const write = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const saver = createSaver({ write });
    const first = saver.flush();
    const second = saver.flush();
    await vi.advanceTimersByTimeAsync(0);
    saver.stop();
    finish();
    await Promise.all([first, second]);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('reports a failed write instead of throwing', async () => {
    const onError = vi.fn();
    const saver = createSaver({
      write: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
      onError,
    });
    await saver.flush();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('device mode files', () => {
  it('writes only new or changed files, and deletes removed ones', () => {
    const a = image('a');
    const b = image('b');
    const c = pdf('c');
    const last = new Map([
      ['a', a],
      ['b', b],
    ]);
    // b replaced (e.g. "Compress more" gives it a new object), c added, a kept.
    const now = new Map<string, UploadedFile>([
      ['a', a],
      ['b', { ...b }],
      ['c', c],
    ]);
    expect(planFileWrites(last, now)).toEqual({ put: ['b', 'c'], del: [] });
    expect(planFileWrites(now, new Map([['c', c]]))).toEqual({ put: [], del: ['a', 'b'] });
    // Reordering within a slot changes the record, not the files.
    expect(planFileWrites(now, new Map([...now].reverse()))).toEqual({ put: [], del: [] });
  });

  it('stores both image versions without the thumbnail URL, and restores a new one', () => {
    const stored = toStored(image('a'));
    expect(stored).not.toHaveProperty('thumbUrl');
    expect(stored).toMatchObject({ kind: 'image', id: 'a' });
    const back = fromStored(stored);
    expect(back?.kind).toBe('image');
    if (back?.kind === 'image') {
      expect(back.thumbUrl).toMatch(/^blob:/);
      expect(back.color).toBe((stored as { color: Blob }).color);
      expect(back.gray).toBe((stored as { gray: Blob }).gray);
    }
    expect(fromStored(toStored(pdf('p')))).toMatchObject({ kind: 'pdf', id: 'p', pages: 3 });
    for (const bad of [null, {}, { kind: 'image', id: 'x', name: 'n', pages: 1 }]) {
      expect(fromStored(bad)).toBeNull();
    }
  });

  it('round-trips slot order and grayscale, leaving out files that are missing', () => {
    let uploads = emptyUploads<SlotId>();
    uploads = addFiles(uploads, 'depositProof', [image('a'), pdf('b'), image('c')]);
    uploads = { ...uploads, grayscale: { other: true } };
    const snapshot: Snapshot = { state: signed(), uploads, page: 'documents.depositProof' };
    const { record, files } = deviceDraft(snapshot, NOW.toISOString());
    expect(record.slots).toEqual({ depositProof: ['a', 'b', 'c'] });
    expect(record.state.signature).toEqual(initialState().signature);
    const parsed = parseDeviceRecord(structuredClone(record));
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    const stored = new Map(
      [...files].filter(([id]) => id !== 'b').map(([id, f]) => [id, toStored(f)]),
    );
    const restored = restoreUploads(parsed, stored);
    expect(restored.files.depositProof?.map((f) => f.id)).toEqual(['a', 'c']);
    expect(restored.grayscale).toEqual({ other: true });
  });
});

describe('IndexedDB outcomes', () => {
  it('reports deleted, blocked, failed, and a silent request as blocked', async () => {
    const { factory } = fakeIdb({ exists: true, deletes: ['success', 'blocked', 'error'] });
    expect(await deleteDatabase(factory, 'db')).toBe('deleted');
    expect(await deleteDatabase(factory, 'db')).toBe('blocked');
    expect(await deleteDatabase(factory, 'db')).toBe('failed');
    vi.useFakeTimers();
    const silent = fakeIdb({ exists: true, deletes: ['nothing'] });
    const pending = deleteDatabase(silent.factory, 'db');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toBe('blocked');
  });

  it('lets go of the database on versionchange, and treats only a delete as an erase', () => {
    const db = { close: vi.fn() };
    const onClosed = vi.fn();
    const onDeleted = vi.fn();
    handleVersionChange({ newVersion: 2 }, db, onClosed, onDeleted);
    expect(db.close).toHaveBeenCalledTimes(1);
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(onDeleted).not.toHaveBeenCalled();
    handleVersionChange({ newVersion: null }, db, onClosed, onDeleted);
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });
});

describe('drafts on load (session mode)', () => {
  const deps = (session: MemoryStorage, now = () => NOW) => ({
    session,
    idb: null,
    now,
    onFailure: vi.fn(),
    onRemoteDeleted: vi.fn(),
  });

  it('saves the answers, then finds them after a reload with the slots to refill', async () => {
    const session = new MemoryStorage();
    const drafts = createDrafts(deps(session));
    const uploads = addFiles(emptyUploads<SlotId>(), 'depositProof', [image('a')]);
    await drafts.start('session', { state: signed(), uploads, page: 'review' });
    expect(session.getItem(SESSION_DRAFT_KEY)).toBeTruthy();

    const result = await createDrafts(deps(session)).boot();
    expect(result.kind).toBe('found');
    if (result.kind !== 'found') return;
    expect(result.mode).toBe('session');
    expect(result.snapshot.page).toBe('review');
    expect(result.snapshot.state.tenant.name).toBe(type23AllYes.tenant.name);
    expect(result.snapshot.state.signature).toEqual(initialState().signature);
    expect(result.snapshot.uploads.files).toEqual({});
    expect(result.filesToReadd).toEqual(['depositProof']);
  });

  it('clears a draft older than 30 days', async () => {
    const session = new MemoryStorage();
    await createDrafts(deps(session, () => new Date(ago(31)))).start('session', {
      state: type23AllYes,
      uploads: emptyUploads(),
      page: 'review',
    });
    expect((await createDrafts(deps(session)).boot()).kind).toBe('expired');
    expect(session.getItem(SESSION_DRAFT_KEY)).toBeNull();
  });

  it('switches to memory only, and says so, when saving fails', async () => {
    const session = new MemoryStorage();
    session.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    const d = deps(session);
    const drafts = createDrafts(d);
    await drafts.start('session', { state: type23AllYes, uploads: emptyUploads(), page: 'review' });
    expect(d.onFailure).toHaveBeenCalledWith('quota');
    expect(drafts.mode).toBeNull();
  });
});
