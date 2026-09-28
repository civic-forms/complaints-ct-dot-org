// The form template, bundled into this lazily loaded chunk as a base64 data URL
// and decoded in memory. Never fetched (CLAUDE.md §8): CSP connect-src is
// 'none' or the telemetry origin, so a fetch would be blocked. This is the only
// module that imports the PDF. When the State revises the form, update the path
// here together with TEMPLATE_FILENAME and template.sha256 (§5.3); a test checks
// they agree.

import type { PdfAssets } from '../../../core/pdf/assemble.ts';
import templateDataUrl from './sdcompform-rev-2026.pdf?inline';
import sha256File from './template.sha256?raw';

export function decodeDataUrl(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  if (!header.endsWith(';base64')) return new TextEncoder().encode(decodeURIComponent(body));
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const EXPECTED_SHA256 = sha256File.trim().split(/\s+/)[0] ?? '';

export async function loadTemplateAssets(): Promise<PdfAssets> {
  const template = decodeDataUrl(templateDataUrl);
  // §5: verify the committed hash at app start in dev builds (tests check it too).
  if (import.meta.env.DEV && (await sha256Hex(template)) !== EXPECTED_SHA256) {
    throw new Error('Form template does not match template.sha256');
  }
  return { template };
}
