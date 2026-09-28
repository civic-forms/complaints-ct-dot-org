import { describe, expect, it } from 'vitest';
import { resolveAppVersion } from '../../scripts/app-version.ts';

describe('resolveAppVersion', () => {
  it('cuts a full Cloudflare Pages SHA to 7 characters', () => {
    expect(
      resolveAppVersion({ cfPagesCommitSha: '70ea4f5c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a' }),
    ).toBe('70ea4f5');
  });

  it('prefers the Cloudflare SHA over the local git SHA', () => {
    expect(
      resolveAppVersion({ cfPagesCommitSha: 'abcdef0123456789', gitShortSha: '1234567' }),
    ).toBe('abcdef0');
  });

  it('uses the local git short SHA when Cloudflare is not set', () => {
    expect(resolveAppVersion({ gitShortSha: '063a2d2' })).toBe('063a2d2');
  });

  it('gives the same value for the same commit from either source', () => {
    const full = '063a2d2aaaabbbbccccddddeeeeffff000011112';
    expect(resolveAppVersion({ cfPagesCommitSha: full })).toBe(
      resolveAppVersion({ gitShortSha: full.slice(0, 7) }),
    );
  });

  it('falls back to "dev" for missing or invalid input', () => {
    expect(resolveAppVersion({})).toBe('dev');
    expect(resolveAppVersion({ gitShortSha: '' })).toBe('dev');
    expect(resolveAppVersion({ cfPagesCommitSha: 'not-a-sha' })).toBe('dev');
    expect(resolveAppVersion({ gitShortSha: 'abc' })).toBe('dev');
  });
});
