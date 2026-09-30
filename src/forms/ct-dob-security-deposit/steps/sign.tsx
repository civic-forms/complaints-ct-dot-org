// Read and sign (CLAUDE.md §7): the State's page 2 text only, verbatim, over
// two pages. First the statements and "I have read"; then the attestation
// directly above the signature, and the date. The date is set to today on
// every visit; like the signature, it is never persisted (§9.2). The signature
// pad arrives in Phase 4.

import { useEffect } from 'preact/hooks';
import { todayIso } from '../../../core/format/date.ts';
import { CheckboxField, DateField } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import verbatim from '../verbatim.json' with { type: 'json' };
import { kit } from './kit.ts';
import type { StepProps } from './types.ts';

const s = en.steps.sign;

export function Statements(props: StepProps) {
  const k = kit(props);
  return (
    <>
      <section class="verbatim-block" aria-labelledby="page2-heading">
        <h2 id="page2-heading" class="verbatim">
          {verbatim.page2Heading}
        </h2>
        {verbatim.page2Statements.map((statement) => (
          <p key={statement} class="verbatim">
            {statement}
          </p>
        ))}
      </section>
      <CheckboxField
        id="statements-read"
        label={s.readCheckbox}
        checked={props.state.signature.statementsRead}
        onChange={(statementsRead) => k.patch('signature', { statementsRead })}
      />
    </>
  );
}

export function Signature(props: StepProps) {
  const k = kit(props);
  // Once per visit (the page remounts each time it's entered).
  useEffect(() => {
    k.patch('signature', { signedDate: todayIso() });
  }, []);
  return (
    <>
      <p class="verbatim attestation">{verbatim.attestation}</p>
      <div class="signature-placeholder">{s.signaturePlaceholder}</div>
      <DateField
        id="signature-date"
        label={s.dateLabel}
        help={s.dateHelp}
        value={props.state.signature.signedDate}
        onChange={(signedDate) => k.patch('signature', { signedDate })}
        messages={k.inline('signature.signedDate')}
      />
    </>
  );
}
