// Step 1: the four complaint types and footnotes, verbatim (CLAUDE.md §2.2),
// with neutral consistency notes (§6.3). Nothing is pre-selected.

import { CheckboxField, Notice } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import { COMPLAINT_TYPES } from '../schema.ts';
import verbatim from '../verbatim.json' with { type: 'json' };
import { kit } from './kit.ts';
import type { StepProps } from './types.ts';

const s = en.steps.situation;

export function Situation(props: StepProps) {
  const { state } = props;
  const k = kit(props);
  const notes = [...k.inline('box1WithCurrent'), ...k.inline('box2And3')];
  return (
    <>
      <p>{s.intro}</p>
      <fieldset class="field">
        <legend class="verbatim">{verbatim.complaintIntro}</legend>
        {COMPLAINT_TYPES.map((type, i) => (
          <CheckboxField
            key={type}
            id={`type-${type}`}
            label={
              <>
                <span class="box-number">{i + 1}.</span> {verbatim.complaintTypes[type]}
              </>
            }
            checked={state.complaintTypes[type]}
            onChange={(checked) => k.patch('complaintTypes', { [type]: checked })}
          />
        ))}
      </fieldset>
      <div class="footnotes verbatim">
        {verbatim.complaintFootnotes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
      <p class="field-help">
        <strong>{s.periodicRentTerm}:</strong> {s.periodicRentDefinition}
      </p>
      <div aria-live="polite">
        {notes.map((note) => (
          <Notice key={note} kind="warning">
            {note}
          </Notice>
        ))}
      </div>
    </>
  );
}
