// Entry point for building packets from the UI. Imported lazily, so pdf-lib and
// the fill code stay out of the main bundle until Review needs them.

import { loadPdfAssets } from './assets.ts';
import { buildComplaintPacket, type ComplaintPacket, type PacketMode } from './packet.ts';
import type { DepositComplaintState } from './schema.ts';
import { type SlotUploads, slotFilesFor } from './uploads.ts';

export async function buildPacket(
  state: DepositComplaintState,
  uploads: SlotUploads,
  mode: PacketMode,
): Promise<ComplaintPacket> {
  const [assets, files] = await Promise.all([loadPdfAssets(), slotFilesFor(state, uploads)]);
  return buildComplaintPacket(state, files, { mode, assets });
}

export { packetFilename } from './packet.ts';
