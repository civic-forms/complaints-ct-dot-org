// Uploaded files by slot (CLAUDE.md §8.4, §8.5). One store keyed by slot id,
// so a slot offered on two pages is one piece of state. Reducers are pure; the
// caller releases a file's object URL (releaseFile) when it leaves the store.

import { revokeObjectUrl } from '../blob-urls.ts';
import type { ImagePreset } from '../images/presets.ts';

interface FileBase {
  id: string;
  /** Shown in the UI only. Never sent anywhere or printed. */
  name: string;
  /** Pages this file adds to the packet. */
  pages: number;
}

export type UploadedFile =
  | (FileBase & {
      kind: 'image';
      /** Compressed JPEG; the original was discarded on add. */
      color: Blob;
      /** The same image in grayscale, from the same decode. */
      gray: Blob;
      /** Preview of `color` (registered in blob-urls.ts). */
      thumbUrl: string;
      preset: ImagePreset['id'];
    })
  | (FileBase & { kind: 'pdf'; pdf: Blob });

export interface UploadState<K extends string> {
  files: Partial<Record<K, UploadedFile[]>>;
  /** Per-slot overrides of the grayscale toggle; the default comes from the slot. */
  grayscale: Partial<Record<K, boolean>>;
}

export const emptyUploads = <K extends string>(): UploadState<K> => ({ files: {}, grayscale: {} });

/** The version of a file that goes into the packet. */
export function activeBlob(file: UploadedFile, gray: boolean): Blob {
  if (file.kind === 'pdf') return file.pdf;
  return gray ? file.gray : file.color;
}

export function addFiles<K extends string>(
  state: UploadState<K>,
  slot: K,
  files: readonly UploadedFile[],
): UploadState<K> {
  return { ...state, files: { ...state.files, [slot]: [...(state.files[slot] ?? []), ...files] } };
}

export function removeFile<K extends string>(
  state: UploadState<K>,
  slot: K,
  id: string,
): UploadState<K> {
  const files = (state.files[slot] ?? []).filter((f) => f.id !== id);
  return { ...state, files: { ...state.files, [slot]: files } };
}

/** Moves a file one place up (-1) or down (1) within its slot; no-op at the ends. */
export function moveFile<K extends string>(
  state: UploadState<K>,
  slot: K,
  id: string,
  by: -1 | 1,
): UploadState<K> {
  const files = [...(state.files[slot] ?? [])];
  const from = files.findIndex((f) => f.id === id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= files.length) return state;
  const [file] = files.splice(from, 1);
  if (file) files.splice(to, 0, file);
  return { ...state, files: { ...state.files, [slot]: files } };
}

export function setGrayscale<K extends string>(
  state: UploadState<K>,
  slot: K,
  gray: boolean,
): UploadState<K> {
  return { ...state, grayscale: { ...state.grayscale, [slot]: gray } };
}

/** Replaces files by id wherever they are (e.g. after "Compress more"). */
export function replaceFiles<K extends string>(
  state: UploadState<K>,
  replacements: ReadonlyMap<string, UploadedFile>,
): UploadState<K> {
  const files: Partial<Record<K, UploadedFile[]>> = {};
  for (const [slot, list] of Object.entries(state.files) as [K, UploadedFile[]][]) {
    files[slot] = list.map((f) => replacements.get(f.id) ?? f);
  }
  return { ...state, files };
}

/** Releases what a file holds outside the store (its thumbnail URL). */
export function releaseFile(file: UploadedFile): void {
  if (file.kind === 'image') revokeObjectUrl(file.thumbUrl);
}
