// What this browser can do for sending (CLAUDE.md §8.6). navigator.share and
// navigator.clipboard exist only on secure origins (https, localhost), so
// each check looks before using them and never throws; the app falls back
// to download + mailto and a selectable address.

export interface BrowserEnv {
  isSecureContext: boolean;
  navigator: Partial<Pick<Navigator, 'share' | 'canShare' | 'clipboard'>>;
}

const currentEnv = (): BrowserEnv => ({ isSecureContext: window.isSecureContext, navigator });

/** The share sheet can take this file (tier 1). */
export function canShareFiles(file: File, env: BrowserEnv = currentEnv()): boolean {
  try {
    const { share, canShare } = env.navigator;
    return (
      env.isSecureContext &&
      typeof share === 'function' &&
      typeof canShare === 'function' &&
      canShare.call(env.navigator, { files: [file] })
    );
  } catch {
    return false;
  }
}

export function canCopy(env: BrowserEnv = currentEnv()): boolean {
  try {
    return env.isSecureContext && typeof env.navigator.clipboard?.writeText === 'function';
  } catch {
    return false;
  }
}

export type SendTier = 'share' | 'mailto';

export const sendTier = (shareable: boolean): SendTier => (shareable ? 'share' : 'mailto');

/** A mouse or trackpad: offer the .eml draft (tier 3). */
export function isDesktop(): boolean {
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}
