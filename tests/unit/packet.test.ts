import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { PdfLockedError, PdfUnreadableError } from '../../src/core/pdf/errors.ts';
import type { AttachmentFile } from '../../src/core/pdf/pages.ts';
import { TEXT_FIELDS } from '../../src/forms/ct-dob-security-deposit/fieldMap.ts';

import {
  buildComplaintPacket,
  DisclaimerNotAcceptedError,
  packetFilename,
  SignatureMissingError,
  type SlotFiles,
} from '../../src/forms/ct-dob-security-deposit/packet.ts';
import { initialState } from '../../src/forms/ct-dob-security-deposit/schema.ts';
import { textValue } from '../../src/forms/ct-dob-security-deposit/values.ts';
import {
  makeState,
  noAttachments,
  overflow,
  type1NoAnswers,
  type23AllYes,
} from '../fixtures/states.ts';
import { loadAssets, read } from '../helpers/assets.ts';
import { lockedPdf, sampleAttachmentPdf } from '../helpers/pdfs.ts';
import { pngDataUrl, signaturePng } from '../helpers/png.ts';

const assets = loadAssets();
const signed = <T extends { signature: { pngDataUrl: string | null } }>(state: T): T => {
  const copy = structuredClone(state);
  copy.signature.pngDataUrl = pngDataUrl(signaturePng());
  return copy;
};
const jpeg: AttachmentFile = {
  kind: 'image',
  mime: 'image/jpeg',
  bytes: read('tests/fixtures/receipt.jpg'),
};
const fieldText = async (bytes: Uint8Array, name: string) =>
  (await PDFDocument.load(bytes)).getForm().getTextField(name).getText() ?? '';
const field = (path: string) => TEXT_FIELDS.find((e) => e.path === path)?.field ?? '';

describe('packet assembly', () => {
  it('without attachments: 3 form pages + index', async () => {
    const packet = await buildComplaintPacket(signed(noAttachments), {}, { mode: 'final', assets });
    expect(packet.pageCount).toBe(4);
    expect(packet.attachmentRows).toEqual([]);
    const reloaded = await PDFDocument.load(packet.bytes);
    expect(reloaded.getPageCount()).toBe(4);
    expect(reloaded.getForm().getFields()).toHaveLength(0); // flattened
    for (const page of reloaded.getPages())
      expect([page.getWidth(), page.getHeight()]).toEqual([612, 792]);
  });

  it('numbers exhibits by slot in checklist order, skipping empty slots', async () => {
    const files: SlotFiles = {
      other: [jpeg],
      depositProof: [jpeg, jpeg],
      correspondence: [{ kind: 'pdf', bytes: await sampleAttachmentPdf() }],
      proofOfAge: [jpeg], // box 2 isn't checked: not derived, so left out
    };
    const packet = await buildComplaintPacket(type1NoAnswers, files, { mode: 'preview', assets });
    expect(
      packet.attachmentRows.map((r) => [r.number, r.fileCount, r.firstPage, r.lastPage]),
    ).toEqual([
      [1, 2, 5, 6],
      [2, 1, 7, 9],
      [3, 1, 10, 10],
    ]);
    expect(packet.pageCount).toBe(10);
  });

  it('adds continuation page(s) for overflowing text, with a placeholder on the form', async () => {
    expect(overflow.additionalComments.length).toBeGreaterThan(3000);
    const packet = await buildComplaintPacket(
      overflow,
      {},
      { mode: 'preview', assets, flatten: false },
    );
    expect(packet.continuationPageCount).toBeGreaterThanOrEqual(1);
    expect(packet.pageCount).toBe(3 + packet.continuationPageCount + 1);
    expect(await fieldText(packet.bytes, field('additionalComments'))).toBe(
      'See continuation page',
    );
    expect(await fieldText(packet.bytes, field('questions.roommates.names'))).toBe(
      'See continuation page',
    );
    // "Massachusetts" doesn't fit the narrow State box: short placeholder.
    expect(await fieldText(packet.bytes, field('tenant.state'))).toBe('See p. 4');
  });

  it('shrinks long values instead of overflowing when they fit at 7pt+', async () => {
    const packet = await buildComplaintPacket(
      type23AllYes,
      {},
      { mode: 'preview', assets, flatten: false },
    );
    expect(packet.continuationPageCount).toBe(0);
    expect(await fieldText(packet.bytes, field('tenant.name'))).toBe(type23AllYes.tenant.name);
  });

  it('renders follow-ups only when their question is YES (§6.2)', async () => {
    const packet = await buildComplaintPacket(
      type1NoAnswers,
      {},
      {
        mode: 'preview',
        assets,
        flatten: false,
      },
    );
    for (const path of [
      'questions.depositReturned.amountCents',
      'questions.courtAction.docketNumber',
      'questions.landlordOtherProperties.addresses',
    ]) {
      expect(await fieldText(packet.bytes, field(path)), path).toBe('');
    }
    // The stored values are still in state, for if the user switches back.
    expect(type1NoAnswers.questions.courtAction.docketNumber).not.toBe('');
  });

  it('formats multi-value and formatted fields', () => {
    expect(textValue('questions.interestPaid.payments', type23AllYes)).toBe(
      '01/15/24 – $12.34; 01/15/25 – $15.10; 01/15/26 – $16.02',
    );
    expect(textValue('questions.roommates.names', type23AllYes)).toBe(
      'Casey Example; Riley Placeholder',
    );
    expect(textValue('tenant.daytimePhone', type23AllYes)).toBe('(413) 555-0123');
    expect(textValue('rental.moveInDate', type23AllYes)).toBe('06/01/23');
    expect(textValue('rental.securityDepositCents', type23AllYes)).toBe('$2,900.00');
  });
});

describe('unsupported characters', () => {
  it('reports characters that will print as "?" with their field', async () => {
    const state = makeState({
      tenant: { name: 'Łukasz 😀 Wiśniewski' },
      additionalComments: 'Thanks 😀✓',
    });
    const packet = await buildComplaintPacket(
      state,
      {},
      { mode: 'preview', assets, flatten: false },
    );
    expect(packet.unsupportedChars).toEqual([
      { path: 'tenant.name', label: 'Your Name', chars: ['Ł', '😀', 'ś'] },
      {
        path: 'additionalComments',
        label: 'Additional Comments (Attach additional pages if necessary)',
        chars: ['😀', '✓'],
      },
    ]);
    expect(await fieldText(packet.bytes, 'Your Name')).toBe('?ukasz ? Wi?niewski');
  });

  it('reports nothing for text the font can encode', async () => {
    const packet = await buildComplaintPacket(type23AllYes, {}, { mode: 'preview', assets });
    expect(packet.unsupportedChars).toEqual([]);
  });
});

describe('gating', () => {
  it('builds no PDF before the disclaimer is accepted', async () => {
    await expect(
      buildComplaintPacket(initialState(), {}, { mode: 'preview', assets }),
    ).rejects.toBeInstanceOf(DisclaimerNotAcceptedError);
  });

  it('requires the current disclaimer version', async () => {
    const state = makeState();
    state.meta.disclaimerVersion = 'old';
    await expect(
      buildComplaintPacket(state, {}, { mode: 'preview', assets }),
    ).rejects.toBeInstanceOf(DisclaimerNotAcceptedError);
  });

  it('requires a signature for the final packet but not the preview', async () => {
    await expect(
      buildComplaintPacket(noAttachments, {}, { mode: 'final', assets }),
    ).rejects.toBeInstanceOf(SignatureMissingError);
    await expect(
      buildComplaintPacket(noAttachments, {}, { mode: 'preview', assets }),
    ).resolves.toBeTruthy();
  });
});

describe('uploaded PDFs', () => {
  it('rejects a locked PDF', async () => {
    const files: SlotFiles = { depositProof: [{ kind: 'pdf', bytes: await lockedPdf() }] };
    await expect(
      buildComplaintPacket(noAttachments, files, { mode: 'preview', assets }),
    ).rejects.toBeInstanceOf(PdfLockedError);
  });

  it('rejects an unreadable PDF', async () => {
    const files: SlotFiles = {
      depositProof: [{ kind: 'pdf', bytes: new TextEncoder().encode('not a pdf') }],
    };
    await expect(
      buildComplaintPacket(noAttachments, files, { mode: 'preview', assets }),
    ).rejects.toBeInstanceOf(PdfUnreadableError);
  });
});

describe('packetFilename', () => {
  it('uses the sanitized last name and date', () => {
    const state = makeState({ tenant: { name: "  Zoë  O'Brien-Núñez " } });
    expect(packetFilename(state, '2026-09-27')).toBe(
      'CT-Security-Deposit-Complaint_OBrien-Nunez_2026-09-27.pdf',
    );
  });

  it('drops an empty name', () => {
    expect(packetFilename(makeState(), '2026-09-27')).toBe(
      'CT-Security-Deposit-Complaint_2026-09-27.pdf',
    );
  });
});
