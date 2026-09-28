// Entry point for building packets from the UI. Imported lazily, so pdf-lib and
// the fill code stay out of the main bundle until Review needs them.

import { loadPdfAssets } from './assets.ts';
import {
  buildComplaintPacket,
  type ComplaintPacket,
  type PacketMode,
  type SlotFiles,
} from './packet.ts';
import type { DepositComplaintState } from './schema.ts';

export async function buildPacket(
  state: DepositComplaintState,
  files: SlotFiles,
  mode: PacketMode,
): Promise<ComplaintPacket> {
  const assets = await loadPdfAssets();
  return buildComplaintPacket(state, files, { mode, assets });
}

export { packetFilename } from './packet.ts';
