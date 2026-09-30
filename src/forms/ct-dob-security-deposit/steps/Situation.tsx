// Your situation (CLAUDE.md §7): moved out, then for current tenants the age,
// over-limit and bank gates and their confirmations. Gate answers are app-only
// and never print; only a confirmation's Yes checks a type on the form.

import type { ComponentChildren } from 'preact';
import { ChoiceGroup } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import { COMPLAINT_TYPES, type DepositComplaintState } from '../schema.ts';
import verbatim from '../verbatim.json' with { type: 'json' };
import { kit } from './kit.ts';
import { FormText, LegalHelp } from './shared.tsx';
import type { StepProps } from './types.ts';
import { APP_YES_NO, APP_YES_NO_NOT_SURE } from './yesNo.ts';

const p = en.pages;
type Gate = Exclude<keyof DepositComplaintState['gates'], 'confirmed'>;

/** One app-only gate question. "Not sure" (where offered) shows the legal help links. */
export function gateQuestion(
  gate: Gate,
  question: (s: DepositComplaintState) => string,
  opts: { notSure?: boolean; help?: ComponentChildren } = {},
) {
  return function GateQuestion(props: StepProps) {
    const k = kit(props);
    const value = props.state.gates[gate];
    return (
      <ChoiceGroup
        name={`gate-${gate}`}
        legend={question(props.state)}
        heading={true}
        help={opts.help}
        options={opts.notSure ? APP_YES_NO_NOT_SURE : APP_YES_NO}
        value={value}
        onChange={(answer) => k.patch('gates', { [gate]: answer })}
        errorId={k.errorId}
      >
        {value === 'not_sure' && <LegalHelp />}
      </ChoiceGroup>
    );
  };
}

export const MovedOut = gateQuestion('movedOut', () => p.movedOut);
export const Age62OrOlder = gateQuestion('age62OrOlder', () => p.age62OrOlder);
export const OverLimitHeld = gateQuestion(
  'overLimitHeld',
  (s) => (s.gates.age62OrOlder === 'yes' ? p.overLimitHeld62 : p.overLimitHeldUnder62),
  { notSure: true },
);
export const BankInfoGiven = gateQuestion('bankInfoGiven', () => p.bankInfoGiven, {
  notSure: true,
});

/** No type confirmed: the form's own list, and legal help. Send stays disabled (§6.3). */
export function NoTypeNote() {
  return (
    <>
      <h1 tabIndex={-1}>{p.noTypeTitle}</h1>
      <FormText>
        <p>{verbatim.complaintIntro}</p>
        <ol class="plain-list">
          {COMPLAINT_TYPES.map((type) => (
            <li key={type}>{verbatim.complaintTypes[type]}</li>
          ))}
        </ol>
        <div class="footnotes">
          {verbatim.complaintFootnotes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      </FormText>
      <LegalHelp />
    </>
  );
}
