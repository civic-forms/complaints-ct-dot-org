// The rental (CLAUDE.md §7): address, housing complex, type and terms, then the
// timeline (move in, move out, last rent paid), one page each.

import { CheckboxField, ChoiceGroup, DateField, TextField } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import towns from '../ct-towns.json' with { type: 'json' };
import verbatim from '../verbatim.json' with { type: 'json' };
import { kit, onTheForm } from './kit.ts';
import { STATE_INPUT, ZIP_INPUT } from './Person.tsx';
import type { StepProps } from './types.ts';

const q = en.fields.rental;
const labels = verbatim.fieldLabels.rental;
const opt = verbatim.optionLabels;

type TextKey = 'unitStreet' | 'housingComplexName' | 'city' | 'state' | 'zip';

function textProps(key: TextKey, props: StepProps) {
  const k = kit(props);
  return {
    id: `rental-${key}`,
    label: q[key],
    value: props.state.rental[key],
    onInput: (value: string) => k.patch('rental', { [key]: value }),
    hint: onTheForm(labels[key]),
    unprintable: k.chars(`rental.${key}`),
    autoComplete: 'off',
    errorId: k.errorId,
  };
}

export function RentalAddress(props: StepProps) {
  const k = kit(props);
  const { tenant, gates } = props.state;
  // Current tenants' address is the rental's; reusing their own answer is allowed (§2.2).
  const canReuse = gates.movedOut === 'no' && [tenant.street, tenant.city].some((v) => v.trim());
  return (
    <>
      {canReuse && (
        <p>
          <button
            type="button"
            class="button button-secondary"
            onClick={() =>
              k.patch('rental', {
                unitStreet: tenant.street,
                city: tenant.city,
                state: tenant.state,
                zip: tenant.zip,
              })
            }
          >
            {en.pages.useEarlierAddress}
          </button>
        </p>
      )}
      <TextField {...textProps('unitStreet', props)} required={true} />
      <TextField {...textProps('city', props)} suggestions={towns} required={true} />
      <div class="field-row">
        <TextField {...textProps('state', props)} {...STATE_INPUT} />
        <TextField {...textProps('zip', props)} {...ZIP_INPUT} required={true} />
      </div>
    </>
  );
}

export function HousingComplex(props: StepProps) {
  return (
    <TextField
      {...textProps('housingComplexName', props)}
      heading={true}
      label={
        <>
          {q.housingComplexName} <span class="optional">{en.common.optional}</span>
        </>
      }
    />
  );
}

export function TypeOfRental(props: StepProps) {
  const k = kit(props);
  return (
    <ChoiceGroup
      name="rental-type"
      legend={q.typeOfRental}
      heading={true}
      hint={onTheForm(labels.typeOfRental)}
      options={[
        { value: 'residential', label: opt.residential },
        { value: 'vacation', label: opt.vacation },
      ]}
      value={props.state.rental.typeOfRental}
      onChange={(typeOfRental) => k.patch('rental', { typeOfRental })}
      errorId={k.errorId}
    />
  );
}

export function Terms(props: StepProps) {
  const k = kit(props);
  const { terms } = props.state.rental;
  return (
    <fieldset
      class="field"
      aria-describedby={['rental-terms-hint', k.errorId].filter(Boolean).join(' ')}
    >
      <legend class="field-label">
        <h1 class="question" tabIndex={-1}>
          {q.terms}
        </h1>
      </legend>
      <p id="rental-terms-hint" class="field-hint">
        {onTheForm(labels.terms)}
      </p>
      <CheckboxField
        id="rental-terms-lease"
        label={opt.lease}
        checked={terms.lease}
        onChange={(lease) => k.patch('rental', { terms: { ...terms, lease } })}
      />
      <CheckboxField
        id="rental-terms-mtm"
        label={opt.monthToMonth}
        checked={terms.monthToMonth}
        onChange={(monthToMonth) => k.patch('rental', { terms: { ...terms, monthToMonth } })}
      />
    </fieldset>
  );
}

function date(key: 'moveInDate' | 'moveOutDate' | 'lastRentPaidDate') {
  return function RentalDate(props: StepProps) {
    const k = kit(props);
    return (
      <DateField
        id={`rental-${key}`}
        label={q[key]}
        heading={true}
        hint={onTheForm(labels[key])}
        value={props.state.rental[key]}
        onChange={(value) => k.patch('rental', { [key]: value })}
        messages={k.inline(`rental.${key}`)}
        errorId={k.errorId}
      />
    );
  };
}

export const MoveIn = date('moveInDate');
export const MoveOut = date('moveOutDate');
export const LastRentPaid = date('lastRentPaidDate');
