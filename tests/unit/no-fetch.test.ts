// CLAUDE.md §8 / §2.1: runtime assets load as modules, never over the network.
// CSP connect-src is 'none' or the telemetry origin only, so a same-origin
// fetch would be blocked in production.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyUploads } from '../../src/core/uploads/store.ts';
import { buildPacket } from '../../src/forms/ct-dob-security-deposit/preview.ts';
import { type23AllYes } from '../fixtures/states.ts';
import { pngDataUrl, signaturePng } from '../helpers/png.ts';

const SRC = join(import.meta.dirname, '../../src');
// Only the Phase 6 telemetry sender may make network requests (§19).
const ALLOWED_DIR = 'core/telemetry/';
const NETWORK_APIS = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|EventSource|WebSocket|importScripts/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

/** Source without comments, so prose like "never with fetch()" doesn't count. */
const code = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('no network requests for app assets', () => {
  it('loading the template and building preview + final packets never calls fetch or XHR', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('fetch is not allowed')));
    const xhrSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('XMLHttpRequest', xhrSpy);

    const signed = structuredClone(type23AllYes);
    signed.signature.pngDataUrl = pngDataUrl(signaturePng());
    const preview = await buildPacket(type23AllYes, emptyUploads(), 'preview');
    const final = await buildPacket(signed, emptyUploads(), 'final');

    expect(preview.bytes.length).toBeGreaterThan(0);
    expect(final.bytes.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
  });

  it(`no source file outside src/${ALLOWED_DIR} uses a network API`, () => {
    const offenders = sourceFiles(SRC)
      .map((path) => relative(SRC, path).split('\\').join('/'))
      .filter((path) => !path.startsWith(ALLOWED_DIR))
      .filter((path) => NETWORK_APIS.test(code(join(SRC, path))));
    expect(offenders).toEqual([]);
  });
});
