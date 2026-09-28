import { execSync } from 'node:child_process';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';
import { resolveAppVersion } from './scripts/app-version.ts';
import en from './src/i18n/en.json' with { type: 'json' };

function gitShortSha(): string | undefined {
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

const appVersion = resolveAppVersion({
  cfPagesCommitSha: process.env.CF_PAGES_COMMIT_SHA,
  gitShortSha: gitShortSha(),
});

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    preact(),
    {
      // The app name lives only in i18n/en.json (CLAUDE.md header).
      name: 'app-name-in-html',
      transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', en.app.name),
    },
  ],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  build: {
    sourcemap: true,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
