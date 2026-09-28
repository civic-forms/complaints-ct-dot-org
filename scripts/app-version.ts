// VITE_APP_VERSION: the short commit SHA (CLAUDE.md §16, §19.2).
// Both sources are cut to 7 characters so the same commit always gets the same
// version, whether built on Cloudflare Pages or locally.

const SHORT_SHA_LENGTH = 7;
const VERSION_PATTERN = /^[0-9a-f]{7,12}$|^dev$/;

export function resolveAppVersion(sources: {
  cfPagesCommitSha?: string | undefined;
  gitShortSha?: string | undefined;
}): string {
  const raw = sources.cfPagesCommitSha || sources.gitShortSha || '';
  const candidate = raw.trim().toLowerCase().slice(0, SHORT_SHA_LENGTH);
  return VERSION_PATTERN.test(candidate) ? candidate : 'dev';
}
