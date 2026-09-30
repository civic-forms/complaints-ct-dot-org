// Your deposit (CLAUDE.md §7): rent and deposit amounts, the form's "any part
// returned?" with its follow-ups, the former-tenant confirmation, and interest.
// Follow-ups are their own pages and keep their values when hidden (§6.2).

import { ChoiceGroup, DateField, MoneyField } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import { t } from '../../../i18n/t.ts';
import { deriveSlots } from '../checklist.ts';
import type { DepositComplaintState } from '../schema.ts';
import verbatim from '../verbatim.json' with { type: 'json' };
import { kit, onTheForm } from './kit.ts';
import { gateQuestion } from './Situation.tsx';
import type { StepProps } from './types.ts';
import { FORM_YES_NO } from './yesNo.ts';

const f = en.fields;
const labels = verbatim.fieldLabels.rental;
const q = verbatim.page1Labels;

type MoneyKey = 'monthlyRentCents' | 'securityDepositCents' | 'otherDepositCents';

function rentalMoney(key: MoneyKey) {
  return function RentalMoney(props: StepProps) {
    const k = kit(props);
    return (
      <MoneyField
        id={`rental-${key}`}
        label={f.rental[key]}
        heading={true}
        hint={onTheForm(labels[key])}
        cents={props.state.rental[key]}
        onChange={(cents) => k.patch('rental', { [key]: cents })}
        invalidMessage={en.common.moneyInvalid}
        errorId={k.errorId}
      />
    );
  };
}

export const MonthlyRent = rentalMoney('monthlyRentCents');
export const SecurityDeposit = rentalMoney('securityDepositCents');
export const OtherDeposit = rentalMoney('otherDepositCents');
export const OtherDepositPaid = gateQuestion('otherDepositPaid', () => en.pages.otherDepositPaid);

type FormQuestion = 'depositReturned' | 'interestPaid';

/** One of the form's printed YES/NO questions: its own options, plus Skip in the nav. */
export function formYesNo(
  name: string,
  question: string,
  label: string,
  get: (s: DepositComplaintState) => 'yes' | 'no' | null,
  set: (k: ReturnType<typeof kit>, answer: 'yes' | 'no') => void,
) {
  return function FormYesNo(props: StepProps) {
    const k = kit(props);
    return (
      <ChoiceGroup
        name={name}
        legend={question}
        heading={true}
        hint={onTheForm(label)}
        options={FORM_YES_NO}
        value={get(props.state)}
        onChange={(answer) => set(k, answer)}
        errorId={k.errorId}
      />
    );
  };
}

const formQuestion = (key: FormQuestion) =>
  formYesNo(
    `q-${key}`,
    f.questions[key],
    q[key],
    (s) => s.questions[key].answer,
    (k, answer) => k.patchQuestion(key, { answer }),
  );

export const DepositReturned = formQuestion('depositReturned');
export const InterestPaid = formQuestion('interestPaid');
export const CheckCashed = formYesNo(
  'q-checkCashed',
  f.questions.checkCashed,
  q.checkCashed,
  (s) => s.questions.depositReturned.checkCashed,
  (k, checkCashed) => k.patchQuestion('depositReturned', { checkCashed }),
);

export function ReturnedAmount(props: StepProps) {
  const k = kit(props);
  return (
    <MoneyField
      id="q-depositReturned-amount"
      label={f.questions.depositReturnedAmount}
      heading={true}
      hint={onTheForm(q.depositReturned)}
      cents={props.state.questions.depositReturned.amountCents}
      onChange={(amountCents) => k.patchQuestion('depositReturned', { amountCents })}
      invalidMessage={en.common.moneyInvalid}
      errorId={k.errorId}
    />
  );
}

export const FullAmountReturned = gateQuestion(
  'fullAmountReturned',
  () => en.pages.fullAmountReturned,
  { notSure: true },
);

export function InterestPayments(props: StepProps) {
  const k = kit(props);
  const interest = props.state.questions.interestPaid;
  const payments = interest.payments.length
    ? interest.payments
    : [{ date: null, amountCents: null }];
  const setPayment = (i: number, change: Partial<(typeof payments)[number]>) =>
    k.patchQuestion('interestPaid', {
      payments: payments.map((p, j) => (j === i ? { ...p, ...change } : p)),
    });
  const name = (i: number) => t(f.questions.interestPayment, { n: i + 1 });
  return (
    <fieldset
      class="field"
      aria-describedby={['interest-hint', k.errorId].filter(Boolean).join(' ')}
    >
      <legend class="field-label">
        <h1 class="question" tabIndex={-1}>
          {en.pages.interestPayments}
        </h1>
      </legend>
      <p id="interest-hint" class="field-hint">
        {onTheForm(q.interestPaid)}
      </p>
      <div class="list">
        {payments.map((p, i) => (
          <fieldset class="list-row payment" key={i}>
            <legend class="field-label">{name(i)}</legend>
            <DateField
              id={`q-interest-${i}-date`}
              label={f.questions.interestDate}
              value={p.date}
              onChange={(date) => setPayment(i, { date })}
              messages={k.inline(`questions.interestPaid.payments.${i}.date`)}
            />
            <MoneyField
              id={`q-interest-${i}-amount`}
              label={f.questions.interestAmount}
              cents={p.amountCents}
              onChange={(amountCents) => setPayment(i, { amountCents })}
              invalidMessage={en.common.moneyInvalid}
            />
            {payments.length > 1 && (
              <button
                type="button"
                class="button button-quiet"
                onClick={() =>
                  k.patchQuestion('interestPaid', { payments: payments.filter((_, j) => j !== i) })
                }
              >
                {t(en.common.removeItem, { item: name(i) })}
              </button>
            )}
          </fieldset>
        ))}
        <button
          type="button"
          class="button button-secondary"
          onClick={() =>
            k.patchQuestion('interestPaid', {
              payments: [...payments, { date: null, amountCents: null }],
            })
          }
        >
          {en.common.addAnother}
        </button>
      </div>
    </fieldset>
  );
}

/** The documents the form's checklist asks for, from the user's answers (§8.4). Never blocks. */
export function NeededDocs({ state }: StepProps) {
  const n = en.steps.needs;
  const anyType = Object.values(state.complaintTypes).some(Boolean);
  return (
    <>
      <p>{anyType ? n.intro : n.noTypes}</p>
      <ul class="checklist">
        {deriveSlots(state).map((slot) => (
          <li key={slot.id}>
            <span class={slot.appDefined ? undefined : 'verbatim'}>{slot.label}</span>
            {slot.hint && <span class="field-help"> ({slot.hint})</span>}
          </li>
        ))}
      </ul>
    </>
  );
}
