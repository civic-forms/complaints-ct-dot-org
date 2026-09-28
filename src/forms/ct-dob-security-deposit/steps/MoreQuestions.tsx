// Step 7: Cash for Keys, roommates, other properties, correspondence, court
// action. On narrow screens, one question per sub-screen (CLAUDE.md §7).

import { ChoiceGroup, TextField, TextList } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import { t } from '../../../i18n/t.ts';
import verbatim from '../verbatim.json' with { type: 'json' };
import { kit, onTheForm } from './kit.ts';
import type { StepProps } from './types.ts';
import { YES_NO, YES_NO_NOT_SURE } from './yesNo.ts';

const f = en.fields.questions;
const q = verbatim.page1Labels;

export const MORE_QUESTIONS_COUNT = 5;

export function MoreQuestions(props: StepProps) {
  const k = kit(props);
  const qs = props.state.questions;
  const list = (n: number, template: string) => t(template, { n });
  const questions = [
    <ChoiceGroup
      key="cashForKeys"
      name="q-cashForKeys"
      legend={f.cashForKeys}
      hint={onTheForm(q.cashForKeys)}
      help={
        <>
          <strong>{f.cashForKeysTerm}:</strong> {f.cashForKeysDefinition}
        </>
      }
      options={YES_NO_NOT_SURE}
      value={qs.cashForKeys.answer}
      onChange={(answer) => k.patchQuestion('cashForKeys', { answer })}
    />,
    <ChoiceGroup
      key="roommates"
      name="q-roommates"
      legend={f.roommates}
      hint={onTheForm(q.roommates)}
      options={YES_NO}
      value={qs.roommates.answer}
      onChange={(answer) => k.patchQuestion('roommates', { answer })}
    >
      {qs.roommates.answer === 'yes' && (
        <TextList
          id="q-roommates-names"
          items={qs.roommates.names}
          onChange={(names) => k.patchQuestion('roommates', { names })}
          itemLabel={(n) => list(n, f.roommateName)}
          addLabel={en.common.addAnother}
          removeLabel={(n) => t(en.common.removeItem, { item: list(n, f.roommateName) })}
          autoComplete="off"
          unprintable={k.chars('questions.roommates.names')}
        />
      )}
    </ChoiceGroup>,
    <ChoiceGroup
      key="landlordOtherProperties"
      name="q-landlordOtherProperties"
      legend={f.landlordOtherProperties}
      hint={onTheForm(q.landlordOtherProperties)}
      options={YES_NO}
      value={qs.landlordOtherProperties.answer}
      onChange={(answer) => k.patchQuestion('landlordOtherProperties', { answer })}
    >
      {qs.landlordOtherProperties.answer === 'yes' && (
        <TextList
          id="q-properties"
          items={qs.landlordOtherProperties.addresses}
          onChange={(addresses) => k.patchQuestion('landlordOtherProperties', { addresses })}
          itemLabel={(n) => list(n, f.propertyAddress)}
          addLabel={en.common.addAnother}
          removeLabel={(n) => t(en.common.removeItem, { item: list(n, f.propertyAddress) })}
          autoComplete="off"
          unprintable={k.chars('questions.landlordOtherProperties.addresses')}
        />
      )}
    </ChoiceGroup>,
    <ChoiceGroup
      key="correspondenceReceived"
      name="q-correspondenceReceived"
      legend={f.correspondenceReceived}
      hint={onTheForm(q.correspondenceReceived)}
      options={YES_NO}
      value={qs.correspondenceReceived.answer}
      onChange={(answer) => k.patchQuestion('correspondenceReceived', { answer })}
    >
      {qs.correspondenceReceived.answer === 'yes' && (
        <p class="field-help">{f.correspondenceNote}</p>
      )}
    </ChoiceGroup>,
    <ChoiceGroup
      key="courtAction"
      name="q-courtAction"
      legend={f.courtAction}
      hint={onTheForm(q.courtAction)}
      options={YES_NO}
      value={qs.courtAction.answer}
      onChange={(answer) => k.patchQuestion('courtAction', { answer })}
    >
      {qs.courtAction.answer === 'yes' && (
        <TextField
          id="q-courtAction-docket"
          label={f.docketNumber}
          help={f.docketHelp}
          value={qs.courtAction.docketNumber}
          onInput={(docketNumber) => k.patchQuestion('courtAction', { docketNumber })}
          autoComplete="off"
          spellcheck={false}
          unprintable={k.chars('questions.courtAction.docketNumber')}
        />
      )}
    </ChoiceGroup>,
  ];
  return <>{props.narrow ? questions[Math.min(props.sub, questions.length - 1)] : questions}</>;
}
