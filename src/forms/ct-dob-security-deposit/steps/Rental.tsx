// Step 5: the rental unit, type and terms of rental, move-in and move-out.

import { normalizeState, normalizeZip } from '../../../core/format/address.ts';
import { CheckboxField, ChoiceGroup, DateField, TextField } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import verbatim from '../verbatim.json' with { type: 'json' };
import { kit, onTheForm } from './kit.ts';
import type { StepProps } from './types.ts';

const q = en.fields.rental;
const labels = verbatim.fieldLabels.rental;
const opt = verbatim.optionLabels;

export function Rental(props: StepProps) {
  const k = kit(props);
  const { rental } = props.state;
  const text = (key: 'unitStreet' | 'housingComplexName' | 'city' | 'state' | 'zip') => ({
    id: `rental-${key}`,
    label: q[key],
    value: rental[key],
    onInput: (value: string) => k.patch('rental', { [key]: value }),
    hint: onTheForm(labels[key]),
    unprintable: k.chars(`rental.${key}`),
  });
  return (
    <>
      <TextField {...text('unitStreet')} autoComplete="off" required={true} />
      <TextField
        {...text('housingComplexName')}
        label={
          <>
            {q.housingComplexName} <span class="optional">{en.common.optional}</span>
          </>
        }
        autoComplete="off"
      />
      <TextField {...text('city')} autoComplete="off" required={true} />
      <div class="field-row">
        <TextField
          {...text('state')}
          maxLength={2}
          autoCapitalize="characters"
          spellcheck={false}
          autoComplete="off"
          normalize={normalizeState}
        />
        <TextField
          {...text('zip')}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={5}
          autoComplete="off"
          normalize={normalizeZip}
          required={true}
        />
      </div>
      <ChoiceGroup
        name="rental-type"
        legend={q.typeOfRental}
        hint={onTheForm(labels.typeOfRental)}
        options={[
          { value: 'residential', label: opt.residential },
          { value: 'vacation', label: opt.vacation },
        ]}
        value={rental.typeOfRental}
        onChange={(typeOfRental) => k.patch('rental', { typeOfRental })}
      />
      <fieldset class="field" aria-describedby="rental-terms-hint">
        <legend class="field-label">{q.terms}</legend>
        <p id="rental-terms-hint" class="field-hint">
          {onTheForm(labels.terms)}
        </p>
        <CheckboxField
          id="rental-terms-lease"
          label={opt.lease}
          checked={rental.terms.lease}
          onChange={(lease) => k.patch('rental', { terms: { ...rental.terms, lease } })}
        />
        <CheckboxField
          id="rental-terms-mtm"
          label={opt.monthToMonth}
          checked={rental.terms.monthToMonth}
          onChange={(monthToMonth) =>
            k.patch('rental', { terms: { ...rental.terms, monthToMonth } })
          }
        />
      </fieldset>
      <DateField
        id="rental-moveInDate"
        label={q.moveInDate}
        hint={onTheForm(labels.moveInDate)}
        value={rental.moveInDate}
        onChange={(moveInDate) => k.patch('rental', { moveInDate })}
        messages={k.inline('rental.moveInDate')}
      />
      <DateField
        id="rental-moveOutDate"
        label={q.moveOutDate}
        hint={onTheForm(labels.moveOutDate)}
        value={rental.moveOutDate}
        onChange={(moveOutDate) => k.patch('rental', { moveOutDate })}
        messages={k.inline('rental.moveOutDate')}
      />
    </>
  );
}
