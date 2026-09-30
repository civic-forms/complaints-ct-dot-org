// About you and Your landlord (CLAUDE.md §7): name, address, phone, email, one
// page each. The tenant's fields carry full autocomplete tokens; the
// landlord's don't, so the tenant's saved address isn't offered there.

import { normalizeState, normalizeZip } from '../../../core/format/address.ts';
import { TextField } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import type { TextPath } from '../fieldMap.ts';
import verbatim from '../verbatim.json' with { type: 'json' };
import { type AddressKey, addressAttrs, kit, onTheForm } from './kit.ts';
import type { StepProps } from './types.ts';

type Who = 'tenant' | 'landlord';

function fieldProps(who: Who, key: AddressKey, props: StepProps) {
  const k = kit(props);
  return {
    ...addressAttrs(who, key),
    label: en.fields[who][key],
    value: props.state[who][key],
    onInput: (value: string) => k.patch(who, { [key]: value }),
    hint: onTheForm(verbatim.fieldLabels[who][key]),
    unprintable: k.chars(`${who}.${key}` as TextPath),
    errorId: k.errorId,
  };
}

export const STATE_INPUT = {
  maxLength: 2,
  autoCapitalize: 'characters',
  spellcheck: false,
  normalize: normalizeState,
} as const;

export const ZIP_INPUT = {
  inputMode: 'numeric',
  pattern: '[0-9]*',
  maxLength: 5,
  normalize: normalizeZip,
} as const;

function single(who: Who, key: 'name' | 'daytimePhone' | 'email') {
  return function Single(props: StepProps) {
    const optional = key === 'email';
    const label = en.fields[who][key];
    return (
      <TextField
        {...fieldProps(who, key, props)}
        label={
          optional ? (
            <>
              {label} <span class="optional">{en.common.optional}</span>
            </>
          ) : (
            label
          )
        }
        heading={true}
        type={key === 'daytimePhone' ? 'tel' : key === 'email' ? 'email' : 'text'}
        spellcheck={key === 'email' ? false : undefined}
        required={key === 'name' || undefined}
      />
    );
  };
}

function address(who: Who) {
  return function Address(props: StepProps) {
    const required = who === 'tenant';
    return (
      <>
        <TextField {...fieldProps(who, 'street', props)} required={required} />
        <TextField {...fieldProps(who, 'city', props)} required={required} />
        <div class="field-row">
          <TextField {...fieldProps(who, 'state', props)} {...STATE_INPUT} required={required} />
          <TextField {...fieldProps(who, 'zip', props)} {...ZIP_INPUT} required={required} />
        </div>
      </>
    );
  };
}

export const TenantName = single('tenant', 'name');
export const TenantAddress = address('tenant');
export const TenantPhone = single('tenant', 'daytimePhone');
export const TenantEmail = single('tenant', 'email');
export const LandlordName = single('landlord', 'name');
export const LandlordAddress = address('landlord');
export const LandlordPhone = single('landlord', 'daytimePhone');
export const LandlordEmail = single('landlord', 'email');
