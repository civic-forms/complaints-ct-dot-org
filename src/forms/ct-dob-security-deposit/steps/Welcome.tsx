// Step 0 (CLAUDE.md §7): what the tool does, the short notice, the device
// choice (§9.1), the Spanish form link, and legal help (§12).

import { useState } from 'preact/hooks';
import { ExternalLink, Notice } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import { t } from '../../../i18n/t.ts';
import { DOB, formUpdatePending, LEGAL_HELP } from '../config.ts';
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

      <section aria-labelledby="help-heading" class="section">
        <h2 id="help-heading">{w.legalHelpHeading}</h2>
        <p>{w.legalHelpText}</p>
        <ul class="plain-list">
          {LEGAL_HELP.map((org) => (
            <li key={org.url}>
              <ExternalLink href={org.url}>{org.name}</ExternalLink>
              {'phone' in org && org.phone ? ` · ${org.phone}` : ''}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
