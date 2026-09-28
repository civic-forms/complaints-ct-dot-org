// Phase 2: builds sample packets from the fixture states for visual review.
//
//   pnpm samples
//
// Writes a preview and a final PDF per fixture to scripts/out/samples/
// (gitignored). Fixture data is fictional.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AttachmentFile } from '../src/core/pdf/pages.ts';
import {
  buildComplaintPacket,
  type SlotFiles,
} from '../src/forms/ct-dob-security-deposit/packet.ts';
import { FIXTURES } from '../tests/fixtures/states.ts';
import { loadAssets, read } from '../tests/helpers/assets.ts';
import { sampleAttachmentPdf } from '../tests/helpers/pdfs.ts';
import { pngDataUrl, signaturePng } from '../tests/helpers/png.ts';

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
    other: [{ kind: 'image', mime: 'image/png', bytes: signaturePng(1600, 900) }],
  };

  mkdirSync(OUT_DIR, { recursive: true });
  for (const [name, fixture] of Object.entries(FIXTURES)) {
    const state = structuredClone(fixture);
    state.signature.pngDataUrl = pngDataUrl(signaturePng());
    const slotFiles = name === 'no-attachments' ? {} : files;
    for (const mode of ['preview', 'final'] as const) {
      const packet = await buildComplaintPacket(state, slotFiles, { mode, assets });
      const path = join(OUT_DIR, `${name}-${mode}.pdf`);
      writeFileSync(path, packet.bytes);
      const unsupported = packet.unsupportedChars.map((u) => `${u.path}: ${u.chars.join('')}`);
      console.log(
        `${path}  ${packet.pageCount} pages, ${(packet.bytes.length / 1024).toFixed(0)} KB` +
          (packet.continuationPageCount ? `, ${packet.continuationPageCount} continuation` : '') +
          (unsupported.length ? `, replaced: ${unsupported.join('; ')}` : ''),
      );
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
