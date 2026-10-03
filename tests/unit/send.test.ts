// Send (CLAUDE.md §8.6): the email text, mailto: link, .eml draft, and the
// checks that choose a tier without throwing on insecure origins.

import { describe, expect, it } from 'vitest';
import {
  type BrowserEnv,
  canCopy,
  canShareFiles,
  sendTier,
} from '../../src/core/send/capabilities.ts';
import { buildEml, encodeHeader } from '../../src/core/send/eml.ts';
import { mailtoUrl } from '../../src/core/send/message.ts';
import { emailMessage } from '../../src/forms/ct-dob-security-deposit/send.ts';
import { makeState } from '../fixtures/states.ts';

const state = makeState({
  tenant: { name: 'Jordan  Example', daytimePhone: '8605550123' },
  rental: { unitStreet: '12 Elm St', streetLine2: 'Apt 4B' },
});

describe('email text', () => {
  it('builds the subject and body from the user’s answers', () => {
    const { subject, body } = emailMessage(state);
    expect(subject).toBe('Security Deposit Complaint - Jordan Example - 12 Elm St, Apt 4B');
    expect(body).toBe(
      'Attached is my completed Security Deposit Complaint Form and supporting documents.\n\nJordan Example\n(860) 555-0123',
    );
  });

  it('URL-encodes the mailto: link with CRLF line breaks', () => {
    const url = mailtoUrl('DOB.SD@CT.GOV', 'A & B', 'line 1\nline 2');
    expect(url).toBe('mailto:DOB.SD@CT.GOV?subject=A%20%26%20B&body=line%201%0D%0Aline%202');
  });
});

const decodeB64 = (text: string) =>
  Uint8Array.from(atob(text.replace(/\r\n/g, '')), (c) => c.charCodeAt(0));

describe('.eml draft', () => {
  const pdf = Uint8Array.from({ length: 5000 }, (_, i) => i % 256);
  const eml = buildEml({
    to: 'DOB.SD@CT.GOV',
    subject: 'Security Deposit Complaint - Jordan Example - 12 Elm St',
    body: 'Attached.\n\nJordan Example',
    filename: 'CT-Security-Deposit-Complaint_Example_2026-10-03.pdf',
    pdf,
    boundary: 'BOUNDARY',
  });

  it('has the headers, an unsent flag, and CRLF line endings only', () => {
    const [headers] = eml.split('\r\n\r\n');
    expect(headers?.split('\r\n')).toEqual([
      'To: DOB.SD@CT.GOV',
      'Subject: Security Deposit Complaint - Jordan Example - 12 Elm St',
      'X-Unsent: 1',
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="BOUNDARY"',
    ]);
    expect(eml.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(eml).toContain(
      'Content-Disposition: attachment; filename="CT-Security-Deposit-Complaint_Example_2026-10-03.pdf"',
    );
    expect(eml.trimEnd().endsWith('--BOUNDARY--')).toBe(true);
  });

  it('keeps base64 lines to 76 characters, and the PDF reads back intact', () => {
    const pdfPart = eml.split('--BOUNDARY')[2] ?? '';
    const encoded = pdfPart.split('\r\n\r\n')[1] ?? '';
    const lines = encoded.trimEnd().split('\r\n');
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(76);
    // Headers stay within RFC 5322's 998.
    for (const line of eml.split('\r\n')) expect(line.length).toBeLessThanOrEqual(998);
    expect(decodeB64(encoded)).toEqual(pdf);
    const textPart = eml.split('--BOUNDARY')[1] ?? '';
    expect(new TextDecoder().decode(decodeB64(textPart.split('\r\n\r\n')[1] ?? ''))).toBe(
      'Attached.\r\n\r\nJordan Example',
    );
  });

  it('encodes a non-ASCII subject as RFC 2047 words of at most 75 characters', () => {
    const subject = `Security Deposit Complaint - Zoë Łukasiewicz - ${'Ünit '.repeat(20)}`;
    const encoded = encodeHeader(subject);
    const words = encoded.split('\r\n ');
    for (const word of words) {
      expect(word).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
      expect(word.length).toBeLessThanOrEqual(75);
    }
    const decoded = words.map((w) => new TextDecoder().decode(decodeB64(w.slice(10, -2)))).join('');
    expect(decoded).toBe(subject);
    expect(encodeHeader('Plain ASCII')).toBe('Plain ASCII');
  });
});

describe('choosing how to send', () => {
  const file = new File([new Uint8Array(4)], 'a.pdf', { type: 'application/pdf' });
  const share = async () => {};
  const env = (secure: boolean, nav: BrowserEnv['navigator']): BrowserEnv => ({
    isSecureContext: secure,
    navigator: nav,
  });

  it('uses the share sheet only on a secure origin that can share this file', () => {
    expect(canShareFiles(file, env(true, { share, canShare: () => true }))).toBe(true);
    expect(canShareFiles(file, env(false, { share, canShare: () => true }))).toBe(false);
    expect(canShareFiles(file, env(true, { share, canShare: () => false }))).toBe(false);
    expect(canShareFiles(file, env(true, { share }))).toBe(false);
    expect(canShareFiles(file, env(false, {}))).toBe(false);
    const throws = () => {
      throw new TypeError('no');
    };
    expect(canShareFiles(file, env(true, { share, canShare: throws }))).toBe(false);
    expect(sendTier(true)).toBe('share');
    expect(sendTier(false)).toBe('mailto');
  });

  it('offers Copy only where the clipboard API exists', () => {
    const clipboard = { writeText: async () => {} } as unknown as Clipboard;
    expect(canCopy(env(true, { clipboard }))).toBe(true);
    expect(canCopy(env(false, { clipboard }))).toBe(false);
    expect(canCopy(env(true, {}))).toBe(false);
  });
});
