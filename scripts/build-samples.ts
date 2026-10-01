// Phase 2: builds sample packets from the fixture states for visual review.
//
//   pnpm samples
//
// Writes a preview and a final PDF per fixture to scripts/out/samples/
// (gitignored), plus one final packet with a typed "/s/" signature (§14).
// Fixture data is fictional.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AttachmentFile } from '../src/core/pdf/pages.ts';
import {
  buildComplaintPacket,
  type PacketMode,
  type SlotFiles,
} from '../src/forms/ct-dob-security-deposit/packet.ts';
import type { DepositComplaintState } from '../src/forms/ct-dob-security-deposit/schema.ts';
import { FIXTURES } from '../tests/fixtures/states.ts';
import { loadAssets, read } from '../tests/helpers/assets.ts';
import { sampleAttachmentPdf } from '../tests/helpers/pdfs.ts';
import { photoPng, pngDataUrl, signaturePng } from '../tests/helpers/png.ts';

const OUT_DIR = join(import.meta.dirname, 'out/samples');

async function main() {
  const assets = loadAssets();
  const receipt: AttachmentFile = {
    kind: 'image',
    mime: 'image/jpeg',
    bytes: read('tests/fixtures/receipt.jpg'),
  };
  const letters: AttachmentFile = { kind: 'pdf', bytes: await sampleAttachmentPdf() };
  const files: SlotFiles = {
    depositProof: [receipt, receipt],
    correspondence: [letters],
    forwardingAddress: [receipt],
    proofOfAge: [receipt],
    certifiedMailReceipt: [receipt],
    cashForKeysAgreement: [letters],
    other: [{ kind: 'image', mime: 'image/png', bytes: photoPng() }],
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const write = async (
    name: string,
    state: DepositComplaintState,
    slotFiles: SlotFiles,
    mode: PacketMode,
  ) => {
    const packet = await buildComplaintPacket(state, slotFiles, { mode, assets });
    const path = join(OUT_DIR, `${name}-${mode}.pdf`);
    writeFileSync(path, packet.bytes);
    const unsupported = packet.unsupportedChars.map((u) => `${u.path}: ${u.chars.join('')}`);
    console.log(
      `${path}  ${packet.pageCount} pages, ${(packet.bytes.length / 1024).toFixed(0)} KB` +
        (packet.continuationPageCount ? `, ${packet.continuationPageCount} continuation` : '') +
        (unsupported.length ? `, replaced: ${unsupported.join('; ')}` : ''),
    );
  };

  for (const [name, fixture] of Object.entries(FIXTURES)) {
    const state = structuredClone(fixture);
    state.signature.pngDataUrl = pngDataUrl(signaturePng());
    const slotFiles = name === 'no-attachments' ? {} : files;
    for (const mode of ['preview', 'final'] as const) await write(name, state, slotFiles, mode);
  }

  const typed = structuredClone(FIXTURES['no-attachments']);
  typed.signature = { ...typed.signature, method: 'typed', typedName: 'Jordan A. Sample' };
  await write('typed-signature', typed, {}, 'final');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
