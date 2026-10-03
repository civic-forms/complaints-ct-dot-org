// The header on every step (CLAUDE.md §7, §9.1–9.2): the app name, "Start
// over and erase", the "Saved on this device · Erase" indicator in device
// mode, the saving options (the mode switch and the §9.2 note), and progress.

import type { ComponentChildren } from 'preact';
import en from '../i18n/en.json' with { type: 'json' };
import type { Mode } from './drafts.ts';

const h = en.header;

export function SiteHeader({
  showName,
  savingMode,
  showSaving,
  erasePending,
  onErase,
  onSwitch,
  children,
}: {
  showName: boolean;
  /** Where answers are being saved now; null when only in memory. */
  savingMode: Mode | null;
  /** False before a form starts, and in a tab erased from another tab. */
  showSaving: boolean;
  erasePending: boolean;
  onErase: () => void;
  onSwitch: (mode: Mode) => void;
  /** Progress. */
  children?: ComponentChildren;
}) {
  const busy = erasePending || undefined;
  return (
    <header class="site-header">
      {/* Welcome's h1 is the app name already. */}
      {showName && <p class="site-name">{en.app.name}</p>}
      <div class="header-tools">
        {showSaving && savingMode === 'device' && (
          <p class="saved-indicator">
            {h.saved} ·{' '}
            <button type="button" class="link-button" aria-busy={busy} onClick={onErase}>
              {h.erase}
            </button>
          </p>
        )}
        <button type="button" class="link-button" aria-busy={busy} onClick={onErase}>
          {h.startOver}
        </button>
        {showSaving && savingMode && (
          <details class="header-menu">
            <summary>{h.savingMenu}</summary>
            {savingMode === 'device' ? (
              <>
                <p class="field-help">{h.savedNote}</p>
                <button
                  type="button"
                  class="button button-secondary"
                  onClick={() => onSwitch('session')}
                >
                  {h.toSession}
                </button>
              </>
            ) : (
              <>
                <p class="field-help">{h.sessionStatus}</p>
                <button
                  type="button"
                  class="button button-secondary"
                  aria-describedby="to-device-hint"
                  onClick={() => onSwitch('device')}
                >
                  {h.toDevice}
                </button>
                <p id="to-device-hint" class="field-help">
                  {h.toDeviceHint}
                </p>
              </>
            )}
          </details>
        )}
      </div>
      {children}
    </header>
  );
}
