// Fills every option of every checkbox question, reads the saved PDF back, and
// asserts exactly the intended box is on (CLAUDE.md §5.2).

import { PDFDocument, type PDFForm } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { readButtonState } from '../../src/core/pdf/acroform.ts';
import {
  CASH_FOR_KEYS_FIELDS,
  COMPLAINT_TYPE_FIELDS,
  INTENTIONALLY_BLANK,
  TERMS_FIELDS,
  TYPE_OF_RENTAL,
  YES_NO_FIELDS,
  type YesNoQuestion,
} from '../../src/forms/ct-dob-security-deposit/field-map.ts';
import { buildComplaintPacket } from '../../src/forms/ct-dob-security-deposit/packet.ts';
import {
  COMPLAINT_TYPES,
  type DepositComplaintState,
} from '../../src/forms/ct-dob-security-deposit/schema.ts';
import { makeState } from '../fixtures/states.ts';
import { loadAssets } from '../helpers/assets.ts';

const assets = loadAssets();

async function fillAndReload(state: DepositComplaintState): Promise<PDFForm> {
  const packet = await buildComplaintPacket(state, {}, { mode: 'preview', assets, flatten: false });
  return (await PDFDocument.load(packet.bytes)).getForm();
}

/** Widgets that are on, as "Field/OnValue". */
function onWidgets(form: PDFForm, fields: readonly string[]): string[] {
  return fields.flatMap((field) => {
    const { widgets } = readButtonState(form, field);
    return widgets.filter((w) => w.state !== 'Off').map((w) => `${field}/${w.state}`);
  });
}

function expectValue(form: PDFForm, field: string, value: string) {
  expect(readButtonState(form, field).value).toBe(value);
}

function stateFor(question: YesNoQuestion, answer: 'yes' | 'no' | null) {
  const s = makeState();
  switch (question) {
    case 'checkCashed':
      s.questions.depositReturned.answer = 'yes';
      s.questions.depositReturned.checkCashed = answer;
      break;
    default:
      s.questions[question].answer = answer;
  }
  return s;
}

const ALL_BUTTONS = [
  ...Object.values(YES_NO_FIELDS),
  TYPE_OF_RENTAL.field,
  ...Object.values(TERMS_FIELDS),
  ...Object.values(CASH_FOR_KEYS_FIELDS),
  ...Object.values(COMPLAINT_TYPE_FIELDS),
];
const PAGE3 = INTENTIONALLY_BLANK.filter((name) => name !== 'IfYes2');

describe('YES/NO questions', () => {
  const cases = (Object.keys(YES_NO_FIELDS) as YesNoQuestion[]).flatMap((question) =>
    (['yes', 'no', null] as const).map((answer) => [question, answer] as const),
  );

  it.each(cases)('%s = %s', async (question, answer) => {
    const form = await fillAndReload(stateFor(question, answer));
    const field = YES_NO_FIELDS[question];
    const expected = answer === null ? [] : [`${field}/${answer === 'yes' ? 'Yes' : 'No'}`];
    // checkCashed needs depositReturned = YES, which checks that box too.
    const others = question === 'checkCashed' ? [`${YES_NO_FIELDS.depositReturned}/Yes`] : [];
    expect(onWidgets(form, ALL_BUTTONS).sort()).toEqual([...expected, ...others].sort());
    expectValue(form, field, answer === null ? 'Off' : answer === 'yes' ? 'Yes' : 'No');
  });

  it.each(['no', null] as const)(
    'check cashed is not rendered when deposit returned = %s',
    async (returned) => {
      const s = makeState();
      s.questions.depositReturned = { answer: returned, amountCents: 100, checkCashed: 'yes' };
      const form = await fillAndReload(s);
      expect(onWidgets(form, [YES_NO_FIELDS.checkCashed])).toEqual([]);
    },
  );
});

describe('Cash for Keys (three independent boxes)', () => {
  it.each(['yes', 'no', 'not_sure', null] as const)('%s', async (answer) => {
    const s = makeState();
    s.questions.cashForKeys.answer = answer;
    const form = await fillAndReload(s);
    const expected = answer === null ? [] : [`${CASH_FOR_KEYS_FIELDS[answer]}/Yes`];
    expect(onWidgets(form, ALL_BUTTONS)).toEqual(expected);
    for (const [option, field] of Object.entries(CASH_FOR_KEYS_FIELDS)) {
      expectValue(form, field, option === answer ? 'Yes' : 'Off');
    }
  });
});

describe('Type of Rental (one field, two widgets)', () => {
  it.each(['residential', 'vacation', null] as const)('%s', async (type) => {
    const s = makeState();
    s.rental.typeOfRental = type;
    const form = await fillAndReload(s);
    const on = type === null ? null : TYPE_OF_RENTAL.onValues[type];
    expect(onWidgets(form, ALL_BUTTONS)).toEqual(on ? [`${TYPE_OF_RENTAL.field}/${on}`] : []);
    expectValue(form, TYPE_OF_RENTAL.field, on ?? 'Off');
  });
});

describe('Terms of Rental (independent)', () => {
  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])('lease=%s monthToMonth=%s', async (lease, monthToMonth) => {
    const s = makeState();
    s.rental.terms = { lease, monthToMonth };
    const form = await fillAndReload(s);
    const expected = [
      ...(lease ? [`${TERMS_FIELDS.lease}/Yes`] : []),
      ...(monthToMonth ? [`${TERMS_FIELDS.monthToMonth}/Yes`] : []),
    ];
    expect(onWidgets(form, ALL_BUTTONS).sort()).toEqual(expected.sort());
  });
});

describe('complaint types', () => {
  it.each(COMPLAINT_TYPES)('%s alone', async (type) => {
    const s = makeState();
    s.complaintTypes[type] = true;
    const form = await fillAndReload(s);
    expect(onWidgets(form, ALL_BUTTONS)).toEqual([`${COMPLAINT_TYPE_FIELDS[type]}/Yes`]);
  });

  it('all four together', async () => {
    const s = makeState();
    for (const type of COMPLAINT_TYPES) s.complaintTypes[type] = true;
    const form = await fillAndReload(s);
    expect(onWidgets(form, ALL_BUTTONS).sort()).toEqual(
      Object.values(COMPLAINT_TYPE_FIELDS)
        .map((f) => `${f}/Yes`)
        .sort(),
    );
  });
});

describe('fields the app never fills', () => {
  it('leaves page 3 boxes off and IfYes2 empty, even with every answer YES', async () => {
    const s = makeState();
    for (const type of COMPLAINT_TYPES) s.complaintTypes[type] = true;
    s.questions.correspondenceReceived.answer = 'yes';
    s.questions.cashForKeys.answer = 'yes';
    const form = await fillAndReload(s);
    expect(onWidgets(form, PAGE3)).toEqual([]);
    for (const field of PAGE3) expectValue(form, field, 'Off');
    expect(form.getTextField('IfYes2').getText() ?? '').toBe('');
  });
});
