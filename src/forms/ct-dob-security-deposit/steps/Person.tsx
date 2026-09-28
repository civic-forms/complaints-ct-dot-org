// Steps 3 and 4: the tenant and the landlord. Same fields, different labels.
// State and Zip stay within the form's boxes (CLAUDE.md §7).

import { normalizeState, normalizeZip } from '../../../core/format/address.ts';
import { TextField } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import type { TextPath } from '../fieldMap.ts';
import type { Person as PersonState } from '../schema.ts';
import verbatim from '../verbatim.json' with { type: 'json' };
import { kit, onTheForm } from './kit.ts';
import type { StepProps } from './types.ts';

type Who = 'tenant' | 'landlord';

function PersonFields({ who, props }: { who: Who; props: StepProps }) {
  const k = kit(props);
  const person = props.state[who];
  const q = en.fields[who];
  const labels = verbatim.fieldLabels[who];
  // Autofill describes the user; don't offer it for the landlord.
  const auto = (token: string) => (who === 'tenant' ? token : 'off');
  const field = (key: keyof PersonState) => ({
    id: `${who}-${key}`,
    value: person[key],
    onInput: (value: string) => k.patch(who, { [key]: value }),
    hint: onTheForm(labels[key]),
    unprintable: k.chars(`${who}.${key}` as TextPath),
  });
  return (
    <>
      <TextField {...field('name')} label={q.name} autoComplete={auto('name')} required={true} />
      <TextField
        {...field('street')}
        label={q.street}
        autoComplete={auto('street-address')}
        required={who === 'tenant'}
      />
      <TextField
        {...field('city')}
        label={q.city}
        autoComplete={auto('address-level2')}
        required={who === 'tenant'}
      />
      <div class="field-row">
        <TextField
          {...field('state')}
          label={q.state}
          autoComplete={auto('address-level1')}
          maxLength={2}
          autoCapitalize="characters"
          spellcheck={false}
          normalize={normalizeState}
          required={who === 'tenant'}
        />
        <TextField
          {...field('zip')}
          label={q.zip}
          autoComplete={auto('postal-code')}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={5}
          normalize={normalizeZip}
          required={who === 'tenant'}
        />
      </div>
      <TextField
        {...field('daytimePhone')}
        label={q.daytimePhone}
        type="tel"
        autoComplete={auto('tel')}
      />
      <TextField
        {...field('email')}
        label={
          <>
            {q.email} <span class="optional">{en.common.optional}</span>
          </>
        }
        type="email"
        autoComplete={auto('email')}
        spellcheck={false}
      />
    </>
  );
}

export const AboutYou = (props: StepProps) => <PersonFields who="tenant" props={props} />;
export const Landlord = (props: StepProps) => <PersonFields who="landlord" props={props} />;
