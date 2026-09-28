// Low-level AcroForm helpers (CLAUDE.md §5.2, §8.2).

import { type PDFDict, type PDFForm, PDFName, type PDFWidgetAnnotation } from 'pdf-lib';

const OFF = PDFName.of('Off');

/**
 * Selects one widget of a checkbox field by its on-value (e.g. "No"), or clears
 * the field with null. Sets /V and every widget's /AS directly: pdf-lib's own
 * check()/setValue() only accept the first widget's on-value, so they can't
 * select "No" on the form's two-widget Yes/No fields.
 */
export function setButtonState(form: PDFForm, fieldName: string, onValue: string | null): void {
  const field = form.getCheckBox(fieldName);
  const widgets = field.acroField.getWidgets();
  const value = onValue === null ? OFF : PDFName.of(onValue);
  if (onValue !== null && !widgets.some((w) => w.getOnValue() === value)) {
    throw new Error(`Field "${fieldName}" has no widget with on-value "${onValue}"`);
  }
  field.acroField.dict.set(PDFName.of('V'), value);
  for (const widget of widgets) {
    widget.setAppearanceState(widget.getOnValue() === value ? value : OFF);
  }
}

/**
 * Checks exactly one field of a group of independent checkboxes (e.g. the
 * form's YES / NO / NOT SURE boxes), clearing the others. null clears all.
 */
export function setExclusive(form: PDFForm, fieldNames: readonly string[], chosen: string | null) {
  if (chosen !== null && !fieldNames.includes(chosen)) {
    throw new Error(`"${chosen}" is not one of ${fieldNames.join(', ')}`);
  }
  for (const name of fieldNames) {
    const onValue = firstOnValue(form, name);
    setButtonState(form, name, name === chosen ? onValue : null);
  }
}

function firstOnValue(form: PDFForm, fieldName: string): string {
  const onValue = form.getCheckBox(fieldName).acroField.getWidgets()[0]?.getOnValue();
  if (!onValue) throw new Error(`Field "${fieldName}" has no on-value`);
  return onValue.decodeText();
}

/** Sets a checkbox field's single widget on or off. */
export function setCheckbox(form: PDFForm, fieldName: string, on: boolean): void {
  setButtonState(form, fieldName, on ? firstOnValue(form, fieldName) : null);
}

/**
 * Inner text box of a text field's first widget, matching the inset pdf-lib
 * uses when it draws the appearance (border width + 1pt padding per side).
 */
export function textFieldBox(form: PDFForm, fieldName: string) {
  const widget = form.getTextField(fieldName).acroField.getWidgets()[0];
  if (!widget) throw new Error(`Field "${fieldName}" has no widget`);
  const rect = widget.getRectangle();
  const inset = (borderWidth(widget) + 1) * 2;
  return { width: Math.abs(rect.width) - inset, height: Math.abs(rect.height) - inset };
}

function borderWidth(widget: PDFWidgetAnnotation): number {
  return widget.getBorderStyle()?.getWidth() ?? 0;
}

/** Sets text at an explicit font size (the caller has already fitted it). */
export function setText(form: PDFForm, fieldName: string, text: string, size: number): void {
  const field = form.getTextField(fieldName);
  // Some fields rely on the AcroForm-level /DA; setFontSize needs one on the field.
  if (!field.acroField.getDefaultAppearance())
    field.acroField.setDefaultAppearance('/Helv 0 Tf 0 g');
  field.setText(text);
  field.setFontSize(size);
}

/** Reads a checkbox field's state for tests: /V and each widget's /AS. */
export function readButtonState(form: PDFForm, fieldName: string) {
  const acro = form.getCheckBox(fieldName).acroField;
  const v = acro.dict.get(PDFName.of('V'));
  return {
    value: v instanceof PDFName ? v.decodeText() : 'Off',
    widgets: acro.getWidgets().map((w) => ({
      onValue: w.getOnValue()?.decodeText() ?? null,
      state: appearanceState(w.dict),
    })),
  };
}

function appearanceState(dict: PDFDict): string {
  const as = dict.get(PDFName.of('AS'));
  return as instanceof PDFName ? as.decodeText() : 'Off';
}
