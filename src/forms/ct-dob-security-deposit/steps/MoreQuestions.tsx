// More questions (CLAUDE.md §7): the rest of page 1's YES/NO questions, each
// on its own page, with each follow-up on the page after it.

import { ChoiceGroup, TextField, TextList } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import { t } from '../../../i18n/t.ts';
import verbatim from '../verbatim.json' with { type: 'json' };
import { formYesNo } from './Deposit.tsx';
import { kit, onTheForm } from './kit.ts';
import type { StepProps } from './types.ts';
import { FORM_YES_NO, FORM_YES_NO_NOT_SURE } from './yesNo.ts';

const f = en.fields.questions;
const q = verbatim.page1Labels;

export function CashForKeys(props: StepProps) {
  const k = kit(props);
  return (
    <ChoiceGroup
      name="q-cashForKeys"
      legend={f.cashForKeys}
      heading={true}
      hint={onTheForm(q.cashForKeys)}
      help={
        <>
          <strong>{f.cashForKeysTerm}:</strong> {f.cashForKeysDefinition}
        </>
      }
      options={FORM_YES_NO_NOT_SURE}
      value={props.state.questions.cashForKeys.answer}
      onChange={(answer) => k.patchQuestion('cashForKeys', { answer })}
      errorId={k.errorId}
    />
  );
}

export const Roommates = formYesNo(
  'q-roommates',
  f.roommates,
  q.roommates,
  (s) => s.questions.roommates.answer,
  (k, answer) => k.patchQuestion('roommates', { answer }),
);
export const OtherProperties = formYesNo(
  'q-landlordOtherProperties',
  f.landlordOtherProperties,
  q.landlordOtherProperties,
  (s) => s.questions.landlordOtherProperties.answer,
  (k, answer) => k.patchQuestion('landlordOtherProperties', { answer }),
);
export const CourtAction = formYesNo(
  'q-courtAction',
  f.courtAction,
  q.courtAction,
  (s) => s.questions.courtAction.answer,
  (k, answer) => k.patchQuestion('courtAction', { answer }),
);

export function Correspondence(props: StepProps) {
  const k = kit(props);
  const answer = props.state.questions.correspondenceReceived.answer;
  return (
    <ChoiceGroup
      name="q-correspondenceReceived"
      legend={f.correspondenceReceived}
      heading={true}
      hint={onTheForm(q.correspondenceReceived)}
      options={FORM_YES_NO}
      value={answer}
      onChange={(value) => k.patchQuestion('correspondenceReceived', { answer: value })}
      errorId={k.errorId}
    >
      {answer === 'yes' && <p class="field-help">{f.correspondenceNote}</p>}
    </ChoiceGroup>
  );
}

function list(
  id: string,
  question: string,
  label: string,
  itemTemplate: string,
  key: 'roommates' | 'landlordOtherProperties',
) {
  return function ListPage(props: StepProps) {
    const k = kit(props);
    const items =
      key === 'roommates'
        ? props.state.questions.roommates.names
        : props.state.questions.landlordOtherProperties.addresses;
    const set = (next: string[]) =>
      key === 'roommates'
        ? k.patchQuestion('roommates', { names: next })
        : k.patchQuestion('landlordOtherProperties', { addresses: next });
    const item = (n: number) => t(itemTemplate, { n });
    return (
      <fieldset
        class="field"
        aria-describedby={[`${id}-hint`, k.errorId].filter(Boolean).join(' ')}
      >
        <legend class="field-label">
          <h1 class="question" tabIndex={-1}>
            {question}
          </h1>
        </legend>
        <p id={`${id}-hint`} class="field-hint">
          {onTheForm(label)}
        </p>
        <TextList
          id={id}
          items={items}
          onChange={set}
          itemLabel={item}
          addLabel={en.common.addAnother}
          removeLabel={(n) => t(en.common.removeItem, { item: item(n) })}
          autoComplete="off"
          unprintable={k.chars(
            key === 'roommates'
              ? 'questions.roommates.names'
              : 'questions.landlordOtherProperties.addresses',
          )}
        />
      </fieldset>
    );
  };
}

export const RoommateNames = list(
  'q-roommates-names',
  en.pages.roommateNames,
  q.roommates,
  f.roommateName,
  'roommates',
);
export const PropertyAddresses = list(
  'q-properties',
  en.pages.propertyAddresses,
  q.landlordOtherProperties,
  f.propertyAddress,
  'landlordOtherProperties',
);

export function DocketNumber(props: StepProps) {
  const k = kit(props);
  return (
    <TextField
      id="q-courtAction-docket"
      label={en.pages.docketNumber}
      heading={true}
      hint={onTheForm(q.courtAction)}
      help={f.docketHelp}
      value={props.state.questions.courtAction.docketNumber}
      onInput={(docketNumber) => k.patchQuestion('courtAction', { docketNumber })}
      autoComplete="off"
      spellcheck={false}
      unprintable={k.chars('questions.courtAction.docketNumber')}
      errorId={k.errorId}
    />
  );
}
