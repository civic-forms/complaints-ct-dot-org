// Step 0 (CLAUDE.md §7): what the tool does, the short notice, the device
// choice (§9.1), the Spanish form link, and legal help (§12). Its h1 is the
// app name.

import { useState } from 'preact/hooks';
import { ExternalLink, Notice } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import { t } from '../../../i18n/t.ts';
import { DOB, formUpdatePending } from '../config.ts';
import { LegalHelp } from './shared.tsx';
import type { StepProps } from './types.ts';

const w = en.steps.welcome;

export function Welcome({ update, next }: StepProps) {
  const [showUpdate, setShowUpdate] = useState(formUpdatePending);
  // Persistence comes in Phase 5; for now both choices keep everything in memory.
  const start = (mode: 'session' | 'device') => {
    update((s) => ({ ...s, meta: { ...s.meta, storageMode: mode } }));
    next();
  };
  return (
    <>
      <h1 tabIndex={-1}>{en.app.name}</h1>
      {showUpdate && (
        <Notice onDismiss={() => setShowUpdate(false)} dismissLabel={en.common.dismiss}>
          {en.common.formUpdatePending}
        </Notice>
      )}
      <p class="lead">{t(w.intro)}</p>
      <p>{w.time}</p>
      <Notice>{w.notice}</Notice>

      <section aria-labelledby="device-heading" class="section">
        <h2 id="device-heading">{w.deviceHeading}</h2>
        <div class="start-choice">
          <button type="button" class="button button-primary" onClick={() => start('session')}>
            {w.startSession}
          </button>
          <p class="field-help">{w.startSessionHint}</p>
        </div>
        <div class="start-choice">
          <button type="button" class="button button-secondary" onClick={() => start('device')}>
            {w.startDevice}
          </button>
          <p class="field-help">{w.startDeviceHint}</p>
        </div>
      </section>

      <section aria-labelledby="spanish-heading" class="section" lang="es">
        <h2 id="spanish-heading">{w.spanishHeading}</h2>
        <p lang="en">{w.spanishText}</p>
        {/* Telemetry (spanish_form_link_clicked) is added in Phase 6. */}
        <p>
          <ExternalLink href={DOB.complaintPage}>{w.spanishLink}</ExternalLink>
        </p>
      </section>

      <LegalHelp />
    </>
  );
}
