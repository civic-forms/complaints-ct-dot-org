// The complaint-type gates (CLAUDE.md §6.1, §7 question pattern).

import { describe, expect, it } from 'vitest';
import { isRelevant } from '../../src/app/progress.ts';
import type { ComplaintType } from '../../src/forms/ct-dob-security-deposit/schema.ts';
import { isReachable } from '../../src/forms/ct-dob-security-deposit/situation.ts';
import type { StepId } from '../../src/forms/ct-dob-security-deposit/steps/ids.ts';
import { PAGE_SPECS } from '../../src/forms/ct-dob-security-deposit/steps/pages.ts';
import { type Answers, answer, start } from '../helpers/flow.ts';

const checked = (state: ReturnType<typeof start>) =>
  (Object.keys(state.complaintTypes) as ComplaintType[]).filter((t) => state.complaintTypes[t]);
const relevant = (state: ReturnType<typeof start>, id: StepId) =>
  isRelevant(
    PAGE_SPECS,
    PAGE_SPECS.findIndex((p) => p.id === id),
    state,
  );

const FORMER = 'formerTenantDepositNotReturned';
const OVER_62 = 'currentTenant62PlusExcessOverOneMonth';
const UNDER_62 = 'currentTenantUnder62ExcessOverTwoMonths';
const ESCROW = 'currentTenantNoEscrowInfo';

describe('reaching and checking a complaint type', () => {
  it('checks the former-tenant type only when it is confirmed', () => {
    const base = {
      gates: { movedOut: 'yes' as const },
      questions: { depositReturned: { answer: 'no' as const } },
    };
    expect(checked(start(base))).toEqual([]);
    expect(
      checked(start({ ...base, gates: { movedOut: 'yes', confirmed: { [FORMER]: 'yes' } } })),
    ).toEqual([FORMER]);
  });

  it('reaches the former-tenant type unless the full amount was returned', () => {
    const s = (returned: 'yes' | 'no' | null, full: 'yes' | 'no' | 'not_sure' | null) =>
      start({
        gates: { movedOut: 'yes', fullAmountReturned: full },
        questions: { depositReturned: { answer: returned } },
      });
    expect(isReachable(s('no', null), FORMER)).toBe(true);
    expect(isReachable(s(null, null), FORMER)).toBe(true);
    expect(isReachable(s('yes', 'no'), FORMER)).toBe(true);
    expect(isReachable(s('yes', 'not_sure'), FORMER)).toBe(true);
    expect(isReachable(s('yes', 'yes'), FORMER)).toBe(false);
    // Current tenants never reach it.
    expect(isReachable(start({ gates: { movedOut: 'no' } }), FORMER)).toBe(false);
  });

  it('picks the over-limit type by age, and never both', () => {
    const s = (age: 'yes' | 'no') =>
      start({
        gates: {
          movedOut: 'no',
          age62OrOlder: age,
          overLimitHeld: 'yes',
          confirmed: { [OVER_62]: 'yes', [UNDER_62]: 'yes' },
        },
      });
    expect(checked(s('yes'))).toEqual([OVER_62]);
    expect(checked(s('no'))).toEqual([UNDER_62]);
  });

  it('reaches the confirmation after Not sure on a gate', () => {
    const s = start({
      gates: {
        movedOut: 'no',
        age62OrOlder: 'no',
        overLimitHeld: 'not_sure',
      },
    });
    expect(isReachable(s, UNDER_62)).toBe(true);
    expect(isReachable(s, ESCROW)).toBe(true);
    expect(relevant(s, 'situation.confirm.currentTenantUnder62ExcessOverTwoMonths')).toBe(true);
    expect(relevant(s, 'situation.confirm.currentTenantNoEscrowInfo')).toBe(true);
  });

  it('still leads to the escrow path after Not sure on over-limit', () => {
    const s = start({ gates: { movedOut: 'no', age62OrOlder: 'yes', overLimitHeld: 'not_sure' } });
    expect(relevant(s, 'situation.confirm.currentTenantNoEscrowInfo')).toBe(true);
  });

  it('shows every current tenant the escrow confirmation, whatever the other answers', () => {
    for (const age62OrOlder of ['yes', 'no'] as const) {
      for (const overLimitHeld of ['yes', 'no', 'not_sure'] as const) {
        const s = start({ gates: { movedOut: 'no', age62OrOlder, overLimitHeld } });
        expect(relevant(s, 'situation.confirm.currentTenantNoEscrowInfo')).toBe(true);
      }
    }
    expect(isReachable(start({ gates: { movedOut: 'yes' } }), ESCROW)).toBe(false);
  });

  it('leaves the type unchecked on No at the confirmation', () => {
    const s = start({
      gates: { movedOut: 'no', confirmed: { [ESCROW]: 'no' } },
    });
    expect(isReachable(s, ESCROW)).toBe(true);
    expect(checked(s)).toEqual([]);
    expect(relevant(s, 'situation.noTypeNote')).toBe(true);
  });

  it("unchecks a type when an earlier answer changes, including the form's depositReturned", () => {
    const s = start({
      gates: { movedOut: 'no', confirmed: { [ESCROW]: 'yes' } },
    });
    expect(checked(s)).toEqual([ESCROW]);
    expect(checked(answer(s, { gates: { movedOut: 'yes' } }))).toEqual([]);

    const former = start({
      gates: { movedOut: 'yes', fullAmountReturned: 'yes', confirmed: { [FORMER]: 'yes' } },
      questions: { depositReturned: { answer: 'no' } },
    });
    expect(checked(former)).toEqual([FORMER]);
    expect(checked(answer(former, { questions: { depositReturned: { answer: 'yes' } } }))).toEqual(
      [],
    );
  });

  it('needs a fresh confirmation when a type becomes reachable again', () => {
    const s = start({
      gates: {
        movedOut: 'no',
        age62OrOlder: 'yes',
        overLimitHeld: 'yes',
        confirmed: { [OVER_62]: 'yes' },
      },
    });
    expect(checked(s)).toEqual([OVER_62]);
    const away = answer(s, { gates: { overLimitHeld: 'no' } });
    expect(away.gates.confirmed[OVER_62]).toBeNull();
    const back = answer(away, { gates: { overLimitHeld: 'yes' } });
    expect(back.gates.confirmed[OVER_62]).toBeNull();
    expect(checked(back)).toEqual([]);
    // Other answers are kept (§6.2).
    expect(back.gates.age62OrOlder).toBe('yes');
  });
});

describe('forwarding address', () => {
  const former = (fwd: Answers['fwd']) =>
    start({
      gates: { movedOut: 'yes', confirmed: { [FORMER]: 'yes' } },
      questions: { depositReturned: { answer: 'no' } },
      fwd,
    });

  it('shows the chapter only to tenants who confirmed the former-tenant type', () => {
    expect(relevant(former({}), 'newAddress.intro')).toBe(true);
    expect(relevant(start({ gates: { movedOut: 'yes' } }), 'newAddress.intro')).toBe(false);
    expect(relevant(start({ gates: { movedOut: 'no' } }), 'newAddress.intro')).toBe(false);
  });

  it('stops at the first No or Not sure, and offers the slot after three Yes', () => {
    expect(relevant(former({ fwdGiven: 'no' }), 'newAddress.fwdInWriting')).toBe(false);
    expect(
      relevant(
        former({ fwdGiven: 'yes', fwdInWriting: 'not_sure' }),
        'newAddress.fwdProofAvailable',
      ),
    ).toBe(false);
    const all = former({ fwdGiven: 'yes', fwdInWriting: 'yes', fwdProofAvailable: 'yes' });
    expect(relevant(all, 'newAddress.forwardingAddressSlot')).toBe(true);
    expect(
      relevant(
        former({ fwdGiven: 'yes', fwdInWriting: 'yes', fwdProofAvailable: 'not_sure' }),
        'newAddress.forwardingAddressSlot',
      ),
    ).toBe(false);
  });
});
