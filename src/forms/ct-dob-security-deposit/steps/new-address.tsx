// Your new address (CLAUDE.md §7), for former tenants who confirmed the
// former-tenant type. No or Not sure at any step shows the form's whole
// forwarding-address note; help text never says what counts as "in writing".

import { ChoiceGroup } from '../../../core/ui/fields.tsx';
import en from '../../../i18n/en.json' with { type: 'json' };
import type { DepositComplaintState } from '../schema.ts';
import verbatim from '../verbatim.json' with { type: 'json' };
import { kit } from './kit.ts';
import { FormText, SlotUpload } from './shared.tsx';
import type { StepProps } from './types.ts';
import { APP_YES_NO, APP_YES_NO_NOT_SURE } from './yes-no.ts';

type Key = keyof DepositComplaintState['forwardingAddress'];

function fwdQuestion(key: Key, notSure: boolean) {
  return function FwdQuestion(props: StepProps) {
    const k = kit(props);
    const value = props.state.forwardingAddress[key];
    return (
      <ChoiceGroup
        name={`fwd-${key}`}
        legend={en.pages[key]}
        heading={true}
        options={notSure ? APP_YES_NO_NOT_SURE : APP_YES_NO}
        value={value}
        onChange={(answer) => k.patch('forwardingAddress', { [key]: answer })}
        errorId={k.errorId}
      >
        {(value === 'no' || value === 'not_sure') && (
          <FormText>
            <p>{verbatim.forwardingAddressNote}</p>
          </FormText>
        )}
      </ChoiceGroup>
    );
  };
}

export const FwdGiven = fwdQuestion('fwdGiven', false);
export const FwdInWriting = fwdQuestion('fwdInWriting', true);
export const FwdProofAvailable = fwdQuestion('fwdProofAvailable', true);

export function ForwardingAddressSlot({ state }: StepProps) {
  return (
    <>
      <SlotUpload slotId="forwardingAddress" state={state} />
      <p class="field-help">{en.pages.slotShared}</p>
    </>
  );
}
