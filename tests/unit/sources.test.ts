// Every form field has exactly one source page, reachable on some path, and a
// page's relevance only depends on answers asked before it (CLAUDE.md §7).

import { describe, expect, it } from 'vitest';
import { isRelevant } from '../../src/app/progress.ts';
import {
  COMPLAINT_TYPE_FIELDS,
  TERMS_FIELDS,
  TEXT_FIELDS,
  YES_NO_FIELDS,
} from '../../src/forms/ct-dob-security-deposit/fieldMap.ts';
import {
  COMPLAINT_TYPES,
  type DepositComplaintState,
} from '../../src/forms/ct-dob-security-deposit/schema.ts';
import type { StepId } from '../../src/forms/ct-dob-security-deposit/steps/ids.ts';
import { type FormPath, PAGE_SPECS } from '../../src/forms/ct-dob-security-deposit/steps/pages.ts';
import { start } from '../helpers/flow.ts';

const ALL_FIELDS: FormPath[] = [
  ...TEXT_FIELDS.map((f) => f.path),
  ...Object.keys(YES_NO_FIELDS).map((q) => `yesNo.${q}` as FormPath),
  'cashForKeys',
  'typeOfRental',
  ...Object.keys(TERMS_FIELDS).map((k) => `terms.${k}` as FormPath),
  ...Object.keys(COMPLAINT_TYPE_FIELDS).map((t) => `complaintType.${t}` as FormPath),
  'signature',
  'signedDate',
];

/** Answer combinations covering every gate and follow-up branch. */
function* paths(): Generator<DepositComplaintState> {
  const yn = ['yes', 'no'] as const;
  const yns = ['yes', 'no', 'not_sure'] as const;
  for (const movedOut of yn)
    for (const age62OrOlder of yn)
      for (const overLimitHeld of yns)
        for (const bankInfoGiven of yns)
          for (const returned of yn)
            for (const fullAmountReturned of yns)
              for (const confirm of yn)
                for (const fwd of yn)
                  for (const others of yn)
                    yield start({
                      gates: {
                        movedOut,
                        age62OrOlder,
                        overLimitHeld,
                        bankInfoGiven,
                        fullAmountReturned,
                        otherDepositPaid: others,
                        confirmed: Object.fromEntries(COMPLAINT_TYPES.map((t) => [t, confirm])),
                      },
                      fwd: { fwdGiven: fwd, fwdInWriting: fwd, fwdProofAvailable: fwd },
                      questions: {
                        depositReturned: { answer: returned },
                        interestPaid: { answer: others },
                        roommates: { answer: others },
                        landlordOtherProperties: { answer: others },
                        correspondenceReceived: { answer: others },
                        courtAction: { answer: others },
                        cashForKeys: { answer: others },
                      },
                    });
}

describe('one source question per form field', () => {
  it('lists each printed field in the fills of exactly one page', () => {
    const counts = new Map<FormPath, StepId[]>();
    for (const page of PAGE_SPECS) {
      for (const path of page.fills ?? []) counts.set(path, [...(counts.get(path) ?? []), page.id]);
    }
    for (const path of ALL_FIELDS) expect(counts.get(path), path).toHaveLength(1);
    expect([...counts.keys()].sort()).toEqual([...ALL_FIELDS].sort());
  });

  it('reaches every page, and so every source page, on some path', () => {
    const reached = new Set<StepId>();
    for (const state of paths()) {
      PAGE_SPECS.forEach((page, i) => {
        if (isRelevant(PAGE_SPECS, i, state)) reached.add(page.id);
      });
    }
    const missing = PAGE_SPECS.filter((p) => !p.detourOnly && !reached.has(p.id)).map((p) => p.id);
    expect(missing).toEqual([]);
  });
});

/** The page whose answer sets each state value a `when` may read. */
function writerOf(path: string): StepId | undefined {
  const exact: Record<string, StepId> = {
    'gates.movedOut': 'situation.movedOut',
    'gates.age62OrOlder': 'situation.age62OrOlder',
    'gates.overLimitHeld': 'situation.overLimitHeld',
    'gates.bankInfoGiven': 'situation.bankInfoGiven',
    'gates.fullAmountReturned': 'deposit.fullAmountReturned',
    'gates.otherDepositPaid': 'deposit.otherDepositPaid',
    'forwardingAddress.fwdGiven': 'newAddress.fwdGiven',
    'forwardingAddress.fwdInWriting': 'newAddress.fwdInWriting',
    'forwardingAddress.fwdProofAvailable': 'newAddress.fwdProofAvailable',
    'questions.depositReturned.answer': 'deposit.depositReturned',
    'questions.interestPaid.answer': 'deposit.interestPaid',
    'questions.cashForKeys.answer': 'moreQuestions.cashForKeys',
    'questions.roommates.answer': 'moreQuestions.roommates',
    'questions.landlordOtherProperties.answer': 'moreQuestions.otherProperties',
    'questions.correspondenceReceived.answer': 'moreQuestions.correspondence',
    'questions.courtAction.answer': 'moreQuestions.courtAction',
  };
  if (exact[path]) return exact[path];
  const type = path.match(/^(?:gates\.confirmed|complaintTypes)\.(\w+)$/)?.[1];
  return PAGE_SPECS.find((p) => p.fills?.includes(`complaintType.${type}` as FormPath))?.id;
}

/** Records the leaf paths read from a state. */
function track<T extends object>(obj: T, prefix: string, reads: Set<string>): T {
  return new Proxy(obj, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof key !== 'string') return value;
      const path = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === 'object') return track(value, path, reads);
      reads.add(path);
      return value;
    },
  });
}

describe('gates come before the pages they gate', () => {
  it("only reads answers from earlier pages in each page's relevance rule", () => {
    const order = PAGE_SPECS.map((p) => p.id);
    const problems: string[] = [];
    let checked = 0;
    for (const page of PAGE_SPECS) {
      if (!page.when || page.detourOnly) continue;
      const reads = new Set<string>();
      for (const state of [...paths()].filter((_, i) => i % 97 === 0)) {
        page.when(track(state, '', reads));
      }
      checked += reads.size;
      for (const path of reads) {
        const writer = writerOf(path);
        if (!writer) problems.push(`${page.id} reads ${path}, which no page asks`);
        else if (order.indexOf(writer) >= order.indexOf(page.id)) {
          problems.push(`${page.id} reads ${path}, asked later on ${writer}`);
        }
      }
    }
    expect(checked).toBeGreaterThan(40);
    expect(problems).toEqual([]);
  });
});
