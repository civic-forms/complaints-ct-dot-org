// An unsent email draft as an .eml file (CLAUDE.md §8.6 tier 3), for desktop
// mail apps such as Outlook: RFC 5322 / MIME text with CRLF line endings,
// `X-Unsent: 1` (opens as a draft), a text part and the PDF as base64.

import { toCrlf } from './message.ts';

const CRLF = '\r\n';
const LINE = 76;

export interface EmlInput {
  to: string;
  subject: string;
  body: string;
  filename: string;
  pdf: Uint8Array;
  /** Tests pass a fixed boundary. */
  boundary?: string;
}

export function base64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Base64 in lines of at most 76 characters. */
export function base64Lines(bytes: Uint8Array): string {
  const text = base64(bytes);
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += LINE) lines.push(text.slice(i, i + LINE));
  return lines.join(CRLF);
}

const ASCII_PRINTABLE = /^[\x20-\x7e]*$/;
/** UTF-8 bytes per encoded word: 45 bytes → 60 base64 chars, 72 with the wrapper. */
const WORD_BYTES = 45;

/** A header value, RFC 2047-encoded (`=?UTF-8?B?…?=`, folded) when it isn't ASCII. */
export function encodeHeader(value: string): string {
  if (ASCII_PRINTABLE.test(value)) return value;
  const encoder = new TextEncoder();
  const words: number[][] = [];
  const current: number[] = [];
  // Whole characters only, so no encoded word splits a UTF-8 sequence.
  for (const char of value) {
    const bytes = encoder.encode(char);
    if (current.length + bytes.length > WORD_BYTES) {
      words.push(current.splice(0));
    }
    current.push(...bytes);
  }
  if (current.length) words.push(current);
  return words.map((w) => `=?UTF-8?B?${base64(Uint8Array.from(w))}?=`).join(`${CRLF} `);
}

const quoted = (value: string) => `"${value.replace(/["\\\r\n]/g, '')}"`;

export function newBoundary(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `----=_Part_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export function buildEml({ to, subject, body, filename, pdf, boundary = newBoundary() }: EmlInput) {
  const text = new TextEncoder().encode(toCrlf(body));
  return [
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    'X-Unsent: 1',
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary=${quoted(boundary)}`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(text),
    `--${boundary}`,
    `Content-Type: application/pdf; name=${quoted(filename)}`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename=${quoted(filename)}`,
    '',
    base64Lines(pdf),
    `--${boundary}--`,
    '',
  ].join(CRLF);
}
