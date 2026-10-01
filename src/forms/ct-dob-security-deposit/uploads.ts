// The upload store as this form uses it (CLAUDE.md §8.4, §8.5): files only
// count, print, and weigh in the size budget while their slot is derived from
// the current answers. Files in other slots are kept (in case the answer
// changes back) but left out, as with follow-ups (§6.2).

import { activeBlob, type UploadedFile, type UploadState } from '../../core/uploads/store.ts';
import { deriveSlots, type EvidenceSlot, type SlotId } from './checklist.ts';
import { FORM_OVERHEAD_BYTES } from './config.ts';
import type { SlotFiles } from './packet.ts';
import type { DepositComplaintState } from './schema.ts';

export type SlotUploads = UploadState<SlotId>;

export const grayscaleFor = (slot: EvidenceSlot, uploads: SlotUploads): boolean =>
  uploads.grayscale[slot.id] ?? slot.grayscaleDefault;

export interface AttachedFile {
  slot: EvidenceSlot;
  file: UploadedFile;
  /** Bytes of the version that goes into the packet. */
  bytes: number;
}

/** Every file that goes into the packet, in checklist order. */
export function attachedFiles(state: DepositComplaintState, uploads: SlotUploads): AttachedFile[] {
  return deriveSlots(state).flatMap((slot) => {
    const gray = grayscaleFor(slot, uploads);
    return (uploads.files[slot.id] ?? []).map((file) => ({
      slot,
      file,
      bytes: activeBlob(file, gray).size,
    }));
  });
}

export function slotFileCounts(
  state: DepositComplaintState,
  uploads: SlotUploads,
): Partial<Record<SlotId, number>> {
  const counts: Partial<Record<SlotId, number>> = {};
  for (const { slot } of attachedFiles(state, uploads)) {
    counts[slot.id] = (counts[slot.id] ?? 0) + 1;
  }
  return counts;
}

/** Roughly the final PDF's size: the form pages plus each attachment as stored. */
export function estimatePacketBytes(state: DepositComplaintState, uploads: SlotUploads): number {
  return attachedFiles(state, uploads).reduce((sum, a) => sum + a.bytes, FORM_OVERHEAD_BYTES);
}

/** The bytes the packet builder embeds, per derived slot. */
export async function slotFilesFor(
  state: DepositComplaintState,
  uploads: SlotUploads,
): Promise<SlotFiles> {
  const out: SlotFiles = {};
  for (const { slot, file } of attachedFiles(state, uploads)) {
    const blob = activeBlob(file, grayscaleFor(slot, uploads));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const list = out[slot.id] ?? [];
    list.push(
      file.kind === 'pdf' ? { kind: 'pdf', bytes } : { kind: 'image', mime: 'image/jpeg', bytes },
    );
    out[slot.id] = list;
  }
  return out;
}
