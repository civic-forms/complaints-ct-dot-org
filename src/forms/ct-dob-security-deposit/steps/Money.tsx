// Step 6: rent, deposits, deposit returned (+amount, +check cashed), and
// interest paid (+date/amount rows). Follow-ups show directly under YES and
// are kept in state when the answer changes to NO (CLAUDE.md §6.2).

import { ChoiceGroup, DateField, MoneyField } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import { t } from '../../../i18n/t.ts';
import verbatim from '../verbatim.json' with { type: 'json' };
import { kit, onTheForm } from './kit.ts';
import type { StepProps } from './types.ts';
import { YES_NO } from './yesNo.ts';

const f = en.fields;
const labels = verbatim.fieldLabels.rental;
const q = verbatim.page1Labels;

type MoneyKey = 'monthlyRentCents' | 'securityDepositCents' | 'otherDepositCents';

export function Money(props: StepProps) {
  const k = kit(props);
  const { rental, questions: qs } = props.state;
  const money = (key: MoneyKey) => (
    <MoneyField
      id={`rental-${key}`}
      label={f.rental[key]}
      hint={onTheForm(labels[key])}
      cents={rental[key]}
      onChange={(cents) => k.patch('rental', { [key]: cents })}
      invalidMessage={en.common.moneyInvalid}
    />
  );
  const returned = qs.depositReturned;
  const interest = qs.interestPaid;
  const payments = interest.payments.length
    ? interest.payments
    : [{ date: null, amountCents: null }];
  const setPayment = (i: number, change: Partial<(typeof payments)[number]>) =>
    k.patchQuestion('interestPaid', {
      payments: payments.map((p, j) => (j === i ? { ...p, ...change } : p)),
    });
  return (
    <>
      {money('monthlyRentCents')}
      <DateField
        id="rental-lastRentPaidDate"
        label={f.rental.lastRentPaidDate}
        hint={onTheForm(labels.lastRentPaidDate)}
        value={rental.lastRentPaidDate}
        onChange={(lastRentPaidDate) => k.patch('rental', { lastRentPaidDate })}
        messages={k.inline('rental.lastRentPaidDate')}
      />
      {money('securityDepositCents')}
      {money('otherDepositCents')}

      <ChoiceGroup
        name="q-depositReturned"
        legend={f.questions.depositReturned}
        hint={onTheForm(q.depositReturned)}
        options={YES_NO}
        value={returned.answer}
        onChange={(answer) => k.patchQuestion('depositReturned', { answer })}
      >
        {returned.answer === 'yes' && (
          <>
            <MoneyField
              id="q-depositReturned-amount"
              label={f.questions.depositReturnedAmount}
              cents={returned.amountCents}
              onChange={(amountCents) => k.patchQuestion('depositReturned', { amountCents })}
              invalidMessage={en.common.moneyInvalid}
            />
            <ChoiceGroup
              name="q-checkCashed"
              legend={f.questions.checkCashed}
              hint={onTheForm(q.checkCashed)}
              options={YES_NO}
              value={returned.checkCashed}
              onChange={(checkCashed) => k.patchQuestion('depositReturned', { checkCashed })}
            />
          </>
        )}
      </ChoiceGroup>

      <ChoiceGroup
        name="q-interestPaid"
        legend={f.questions.interestPaid}
        hint={onTheForm(q.interestPaid)}
        options={YES_NO}
        value={interest.answer}
        onChange={(answer) => k.patchQuestion('interestPaid', { answer })}
      >
        {interest.answer === 'yes' && (
          <div class="list">
            {payments.map((p, i) => (
              <fieldset class="list-row payment" key={i}>
                <legend class="field-label">{t(f.questions.interestPayment, { n: i + 1 })}</legend>
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
                      k.patchQuestion('interestPaid', {
                        payments: payments.filter((_, j) => j !== i),
                      })
                    }
                  >
                    {t(en.common.removeItem, {
                      item: t(f.questions.interestPayment, { n: i + 1 }),
                    })}
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
        )}
      </ChoiceGroup>
    </>
  );
}
