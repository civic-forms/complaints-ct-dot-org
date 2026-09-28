import { describe, expect, it } from 'vitest';
import { WIN_ANSI } from '../../src/core/pdf/text.ts';
import { buildComplaintPacket } from '../../src/forms/ct-dob-security-deposit/packet.ts';
import { unprintableMessage } from '../../src/forms/ct-dob-security-deposit/validation.ts';
import { collectUnsupportedChars } from '../../src/forms/ct-dob-security-deposit/values.ts';
import { makeState } from '../fixtures/states.ts';
import { loadAssets } from '../helpers/assets.ts';

const state = makeState({
  tenant: { name: 'Zoë Łukasz', city: 'Łódź' },
  landlord: { name: 'Ωmega LLC 😀' },
  additionalComments: 'Everything is fine ✓',
  questions: {
    roommates: { answer: 'no', names: ['Włodek'] }, // hidden follow-up (§6.2)
    courtAction: { answer: 'yes', docketNumber: 'HFH-CV26-ő' },
  },
});

describe('collectUnsupportedChars (live check, §8.2)', () => {
  it('lists characters per field, once each, in order', () => {
    expect(collectUnsupportedChars(state, WIN_ANSI)).toEqual([
      { path: 'tenant.name', label: 'Your Name', chars: ['Ł'] },
      { path: 'tenant.city', label: 'City/Town', chars: ['Ł', 'ź'] },
      { path: 'landlord.name', label: "Landlord's Name", chars: ['Ω', '😀'] },
      expect.objectContaining({ path: 'questions.courtAction.docketNumber', chars: ['ő'] }),
      expect.objectContaining({ path: 'additionalComments', chars: ['✓'] }),
    ]);
  });

  it('agrees with what the packet build reports', async () => {
    const packet = await buildComplaintPacket(state, {}, { mode: 'preview', assets: loadAssets() });
    expect(collectUnsupportedChars(state, WIN_ANSI)).toEqual(packet.unsupportedChars);
  });

  it('is empty for plain Western European text', () => {
    const plain = makeState({ tenant: { name: 'José Núñez-Müller' } });
    expect(collectUnsupportedChars(plain, WIN_ANSI)).toEqual([]);
  });

  it('formats the inline message', () => {
    expect(unprintableMessage(['ł', 'ő'])).toBe(
      "The form can't print 'ł', 'ő'. Please use a plain letter instead.",
    );
  });
});
