// Confirmation (CLAUDE.md §7): check the Sent folder, DOB's phone numbers,
// "I've sent it" (offers the erase dialog), and the shared-computer erase
// section (§9.3). No progress, like Welcome.

import en from '../../../i18n/en.json' with { type: 'json' };
import { DOB } from '../config.ts';
import type { StepProps } from './types.ts';

const c = en.steps.confirmation;

const telHref = (phone: string) => `tel:${phone.replace(/[^0-9+]/g, '')}`;

export function Confirmation({ app }: StepProps) {
  return (
    <>
      <p class="lead">{c.sentFolder}</p>

      <section class="section" aria-labelledby="confirm-phones">
        <h2 id="confirm-phones">{c.phonesHeading}</h2>
        <p>{c.phonesText}</p>
        <ul class="plain-list">
          {DOB.phones.map((phone) => (
            <li key={phone}>
              <a href={telHref(phone)}>{phone}</a>
            </li>
          ))}
        </ul>
      </section>

      <section class="section">
        {/* Telemetry (Phase 6): sent_confirmed. */}
        <button
          type="button"
          class="button button-primary"
          aria-busy={app.erasePending || undefined}
          aria-describedby="confirm-sent-help"
          onClick={() => app.openErase('confirmation')}
        >
          {c.sentButton}
        </button>
        <p id="confirm-sent-help" class="field-help">
          {c.sentHelp}
        </p>
      </section>

      <section class="section" aria-labelledby="confirm-shared">
        <h2 id="confirm-shared">{c.sharedHeading}</h2>
        <button
          type="button"
          class="button button-secondary"
          aria-busy={app.erasePending || undefined}
          onClick={() => app.openErase('confirmation')}
        >
          {c.sharedButton}
        </button>
        <p>{c.sharedNote}</p>
      </section>
    </>
  );
}
