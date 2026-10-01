import { PDFCheckBox, PDFDocument, PDFTextField } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CASH_FOR_KEYS_FIELDS,
  COMPLAINT_TYPE_FIELDS,
  INTENTIONALLY_BLANK,
  TERMS_FIELDS,
  TEXT_FIELDS,
  TYPE_OF_RENTAL,
  YES_NO_FIELDS,
} from '../../src/forms/ct-dob-security-deposit/field-map.ts';
import { loadAssets } from '../helpers/assets.ts';

let doc: PDFDocument;
beforeAll(async () => {
  doc = await PDFDocument.load(loadAssets().template);
});

const onValues = (name: string) =>
  doc
    .getForm()
    .getCheckBox(name)
    .acroField.getWidgets()
    .map((w) => w.getOnValue()?.decodeText());

describe('field-map.ts against the template', () => {
  it('maps every text field to an existing text field', () => {
    for (const { field } of TEXT_FIELDS) {
      expect(doc.getForm().getField(field), field).toBeInstanceOf(PDFTextField);
    }
  });

  it('uses two-widget Yes/No checkboxes for YES/NO questions', () => {
    for (const field of Object.values(YES_NO_FIELDS))
      expect(onValues(field)).toEqual(['Yes', 'No']);
    expect(onValues(TYPE_OF_RENTAL.field)).toEqual(['Yes', 'No']);
  });

  it('uses single-widget checkboxes for the other boxes', () => {
    const singles = [
      ...Object.values(CASH_FOR_KEYS_FIELDS),
      ...Object.values(COMPLAINT_TYPE_FIELDS),
      ...Object.values(TERMS_FIELDS),
    ];
    for (const field of singles) expect(onValues(field), field).toEqual(['Yes']);
  });

  it('accounts for every field in the template exactly once', () => {
    const mapped = [
      ...TEXT_FIELDS.map((e) => e.field),
      ...Object.values(YES_NO_FIELDS),
      TYPE_OF_RENTAL.field,
      ...Object.values(TERMS_FIELDS),
      ...Object.values(CASH_FOR_KEYS_FIELDS),
      ...Object.values(COMPLAINT_TYPE_FIELDS),
      ...INTENTIONALLY_BLANK,
    ];
    expect(new Set(mapped).size).toBe(mapped.length);
    const all = doc
      .getForm()
      .getFields()
      .map((f) => f.getName());
    expect([...mapped].sort()).toEqual([...all].sort());
  });

  it('lists the 14 page 3 checkboxes and IfYes2 as intentionally blank', () => {
    const page3 = doc.getPage(2).ref;
    const blankBoxes = INTENTIONALLY_BLANK.filter(
      (name) => doc.getForm().getField(name) instanceof PDFCheckBox,
    );
    expect(blankBoxes).toHaveLength(14);
    for (const name of blankBoxes) {
      const widget = doc.getForm().getCheckBox(name).acroField.getWidgets()[0];
      expect(widget?.P()).toBe(page3);
    }
    expect(INTENTIONALLY_BLANK).toContain('IfYes2');
  });
});
