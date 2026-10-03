// The upload store and how the form uses it (CLAUDE.md §8.4, §8.5).

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fileKind, newId } from '../../src/core/uploads/ingest.ts';
import {
  activeBlob,
  addFiles,
  emptyUploads,
  moveFile,
  releaseFile,
  removeFile,
  replaceFiles,
  setGrayscale,
  type UploadedFile,
} from '../../src/core/uploads/store.ts';
import type { SlotId } from '../../src/forms/ct-dob-security-deposit/checklist.ts';
import { FORM_OVERHEAD_BYTES } from '../../src/forms/ct-dob-security-deposit/config.ts';
import { buildPacket } from '../../src/forms/ct-dob-security-deposit/preview.ts';
import {
  attachedFiles,
  estimatePacketBytes,
  type SlotUploads,
  slotFileCounts,
  slotFilesFor,
} from '../../src/forms/ct-dob-security-deposit/uploads.ts';
import { type1NoAnswers } from '../fixtures/states.ts';
import { read } from '../helpers/assets.ts';
import { sampleAttachmentPdf } from '../helpers/pdfs.ts';

const jpegBytes = read('tests/fixtures/receipt.jpg');
const SRC = join(import.meta.dirname, '../../src');

type ImageFile = Extract<UploadedFile, { kind: 'image' }>;

function image(id: string, colorBytes = 300, grayBytes = 200): ImageFile {
  return {
    kind: 'image',
    id,
    name: `${id}.jpg`,
    pages: 1,
    color: new Blob([new Uint8Array(colorBytes).fill(1)], { type: 'image/jpeg' }),
    gray: new Blob([new Uint8Array(grayBytes).fill(2)], { type: 'image/jpeg' }),
    thumbUrl: `blob:test/${id}`,
    preset: 'standard',
  };
}

function pdf(id: string, bytes: Uint8Array, pages = 1): UploadedFile {
  return { kind: 'pdf', id, name: `${id}.pdf`, pages, pdf: new Blob([bytes.slice()]) };
}

const ids = (u: SlotUploads, slot: SlotId) => (u.files[slot] ?? []).map((f) => f.id);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('upload store', () => {
  it('adds, moves (no-op at the ends), and removes files within a slot', () => {
    let u: SlotUploads = emptyUploads();
    u = addFiles(u, 'depositProof', [image('a'), image('b')]);
    u = addFiles(u, 'depositProof', [image('c')]);
    expect(ids(u, 'depositProof')).toEqual(['a', 'b', 'c']);
    u = moveFile(u, 'depositProof', 'c', -1);
    expect(ids(u, 'depositProof')).toEqual(['a', 'c', 'b']);
    expect(moveFile(u, 'depositProof', 'a', -1)).toBe(u);
    expect(moveFile(u, 'depositProof', 'b', 1)).toBe(u);
    u = removeFile(u, 'depositProof', 'c');
    expect(ids(u, 'depositProof')).toEqual(['a', 'b']);
  });

  it('replaces files by id wherever they are', () => {
    let u: SlotUploads = emptyUploads();
    u = addFiles(u, 'depositProof', [image('a')]);
    u = addFiles(u, 'other', [image('b')]);
    const smaller = { ...image('b', 50, 40), preset: 'smaller' as const };
    u = replaceFiles(u, new Map([['b', smaller]]));
    expect(u.files.other?.[0]).toBe(smaller);
    expect(ids(u, 'depositProof')).toEqual(['a']);
  });

  it('uses the grayscale copy only when the toggle is on', () => {
    const file = image('a');
    expect(activeBlob(file, true).size).toBe(200);
    expect(activeBlob(file, false).size).toBe(300);
  });

  it('releases a removed image’s thumbnail URL', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    releaseFile(image('a'));
    expect(revoke).toHaveBeenCalledWith('blob:test/a');
    releaseFile(pdf('p', new Uint8Array([1])));
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it('recognizes images and PDFs, also by extension when the type is missing', () => {
    expect(fileKind({ type: 'image/jpeg', name: 'a.jpg' })).toBe('image');
    expect(fileKind({ type: 'image/heic', name: 'a.heic' })).toBe('image');
    expect(fileKind({ type: '', name: 'IMG_1.HEIC' })).toBe('image');
    expect(fileKind({ type: 'application/pdf', name: 'a' })).toBe('pdf');
    expect(fileKind({ type: '', name: 'lease.PDF' })).toBe('pdf');
    expect(fileKind({ type: 'text/plain', name: 'a.txt' })).toBeNull();
    expect(fileKind({ type: '', name: 'notes' })).toBeNull();
  });
});

describe('file ids', () => {
  it('works where crypto.randomUUID is missing (plain http on a local network)', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
    });
    try {
      const ids = new Set(Array.from({ length: 1000 }, newId));
      expect(ids.size).toBe(1000);
      for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('no source file uses APIs that exist only on secure origins', () => {
    const offenders = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
      .filter((path) => /\.(ts|tsx)$/.test(path))
      .filter((path) => /\brandomUUID\s*\(/.test(readFileSync(join(SRC, path), 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('the form’s use of the store', () => {
  // type1NoAnswers derives: depositProof, rentalAgreement, correspondence,
  // forwardingAddress, other. proofOfAge is not derived.
  const uploads = (): SlotUploads => {
    let u: SlotUploads = emptyUploads();
    u = addFiles(u, 'depositProof', [image('a')]);
    u = addFiles(u, 'other', [image('b')]);
    u = addFiles(u, 'proofOfAge', [image('hidden')]);
    return u;
  };

  it('counts, sizes, and embeds only files in derived slots', async () => {
    const u = uploads();
    expect(slotFileCounts(type1NoAnswers, u)).toEqual({ depositProof: 1, other: 1 });
    expect(attachedFiles(type1NoAnswers, u).map((a) => a.file.id)).toEqual(['a', 'b']);
    // depositProof defaults to grayscale (200), "Other documents" to color (300).
    expect(estimatePacketBytes(type1NoAnswers, u)).toBe(FORM_OVERHEAD_BYTES + 200 + 300);
    const files = await slotFilesFor(type1NoAnswers, u);
    expect(Object.keys(files)).toEqual(['depositProof', 'other']);
    expect(files.depositProof?.[0]).toMatchObject({ kind: 'image', mime: 'image/jpeg' });
    expect(files.depositProof?.[0]?.bytes[0]).toBe(2);
    expect(files.other?.[0]?.bytes[0]).toBe(1);
  });

  it('follows the per-slot grayscale override', async () => {
    let u = uploads();
    u = setGrayscale(u, 'depositProof', false);
    u = setGrayscale(u, 'other', true);
    const files = await slotFilesFor(type1NoAnswers, u);
    expect(files.depositProof?.[0]?.bytes[0]).toBe(1);
    expect(files.other?.[0]?.bytes[0]).toBe(2);
  });

  it('puts the shared forwarding-address slot in the packet once', async () => {
    // Added on the Your new address page or on the Documents step: the same slot.
    let u: SlotUploads = emptyUploads();
    const jpeg = (id: string): UploadedFile => ({
      ...image(id),
      color: new Blob([jpegBytes.slice()]),
      gray: new Blob([jpegBytes.slice()]),
    });
    u = addFiles(u, 'forwardingAddress', [jpeg('from-new-address')]);
    u = addFiles(u, 'forwardingAddress', [jpeg('from-documents')]);
    u = addFiles(u, 'correspondence', [pdf('letters', await sampleAttachmentPdf(), 3)]);
    const packet = await buildPacket(type1NoAnswers, u, 'preview');
    expect(
      packet.attachmentRows.map((r) => [
        r.label.slice(0, 20),
        r.fileCount,
        r.firstPage,
        r.lastPage,
      ]),
    ).toEqual([
      ['Copy of any correspo', 1, 5, 7],
      ['Proof that you provi', 2, 8, 9],
    ]);
  });
});
