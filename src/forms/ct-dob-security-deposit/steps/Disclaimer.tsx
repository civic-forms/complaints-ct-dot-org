// Step 10: the clickwrap (CLAUDE.md §10). Two unchecked boxes; no PDF is built
// until the current version is accepted.

import { useState } from 'preact/hooks';
import { CheckboxField } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import { t } from '../../../i18n/t.ts';
import { acceptDisclaimer, isDisclaimerAccepted } from '../disclaimer.ts';
import type { StepProps } from './types.ts';

const d = en.disclaimer;

export function Disclaimer({ state, update, next }: StepProps) {
  const accepted = isDisclaimerAccepted(state);
  const [notLawyer, setNotLawyer] = useState(accepted);
  const [responsible, setResponsible] = useState(accepted);
  return (
    <>
      <div class="disclaimer">
        {d.sections.map((section) => (
          <p key={section.title}>
            <strong>{section.title}</strong> {t(section.body)}
          </p>
        ))}
      </div>
      <CheckboxField
        id="disclaimer-not-lawyer"
        label={t(d.checkNotLawyer)}
        checked={notLawyer}
        onChange={setNotLawyer}
      />
      <CheckboxField
        id="disclaimer-responsible"
        label={t(d.checkResponsible)}
        checked={responsible}
        onChange={setResponsible}
      />
      {accepted && <p class="field-help">{d.accepted}</p>}
      <div class="actions">
        <button
          type="button"
          class="button button-primary"
          disabled={!(notLawyer && responsible)}
          onClick={() => {
            if (!accepted) update((s) => acceptDisclaimer(s));
            next();
          }}
        >
          {d.agree}
        </button>
      </div>
    </>
  );
}
