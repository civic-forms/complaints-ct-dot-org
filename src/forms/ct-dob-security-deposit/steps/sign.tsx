// Read and sign (CLAUDE.md §7): the State's page 2 text only, verbatim, over
// two pages. First the statements and "I have read"; then the attestation
// directly above the signature, and the date. The date is set to today on
// every visit; like the signature, it is never persisted (§9.2). Drawing is
// the default; "Type your name instead" prints "/s/ {name}" (§14).

import { useEffect } from 'preact/hooks';
import { todayIso } from '../../../core/format/date.ts';
import { SignaturePad } from '../../../core/signature/SignaturePad.tsx';
import { CheckboxField, DateField, TextField } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import { typedSignatureText } from '../signature.ts';
import { unprintableMessage } from '../validation.ts';
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
  const { method, pngDataUrl, typedName } = props.state.signature;
  const typedChars = props.unsupported.find((u) => u.path === 'signature');
  const switchTo = (next: 'drawn' | 'typed') => {
    k.patch('signature', { method: next });
    // Move focus to what replaced the link, so keyboard users aren't left on nothing.
    requestAnimationFrame(() =>
      document.getElementById(next === 'typed' ? 'signature-typed' : 'signature-switch')?.focus(),
    );
  };
  return (
    <>
      <p class="verbatim attestation">{verbatim.attestation}</p>
      {method === 'drawn' ? (
        <div class="field">
          <p id="signature-label" class="field-label">
            {s.drawLabel}
          </p>
          <p id="signature-help" class="field-help">
            {s.drawHelp}
          </p>
          <SignaturePad
            id="signature-pad"
            value={pngDataUrl}
            onChange={(png) => k.patch('signature', { pngDataUrl: png })}
            labels={{ pad: s.padLabel, clear: s.clear }}
            describedBy="signature-label signature-help"
          />
          <p>
            <button
              id="signature-switch"
              type="button"
              class="link-button"
              onClick={() => switchTo('typed')}
            >
              {s.useTyped}
            </button>
          </p>
        </div>
      ) : (
        <>
          <TextField
            id="signature-typed"
            label={s.typedLabel}
            help={s.typedHelp}
            placeholder={s.typedPlaceholder}
            value={typedName}
            autoComplete="off"
            spellcheck={false}
            onInput={(typed) => k.patch('signature', { typedName: typed })}
            unprintable={
              typedChars
                ? { key: typedChars.chars.join(''), message: unprintableMessage(typedChars.chars) }
                : null
            }
          />
          {typedName.trim() && (
            <div class="typed-signature-preview">
              <p class="field-help">{s.typedPreview}</p>
              <p class="typed-signature">{typedSignatureText(typedName)}</p>
            </div>
          )}
          <p>
            <button
              id="signature-switch"
              type="button"
              class="link-button"
              onClick={() => switchTo('drawn')}
            >
              {s.useDrawn}
            </button>
          </p>
        </>
      )}
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
