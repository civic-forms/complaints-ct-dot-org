// Phase 1 / §5.3: AcroForm inventory of a form PDF.
//
//   pnpm form:dump [path/to/form.pdf]
//
// Defaults to the committed template. Prints a readable table and writes stable
// JSON (sorted keys, rounded numbers) to scripts/out/form-fields.json, so two
// revisions can be compared with a plain `diff`.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  PDFButton,
  PDFCheckBox,
  PDFDict,
  PDFDocument,
  PDFDropdown,
  type PDFField,
  PDFHexString,
  PDFName,
  PDFOptionList,
  PDFRadioGroup,
  PDFRef,
  PDFSignature,
  PDFString,
  PDFTextField,
  type PDFWidgetAnnotation,
} from 'pdf-lib';
import { stableJson } from './lib/stable-json.ts';

const ROOT = join(import.meta.dirname, '..');
const DEFAULT_PDF = join(
  ROOT,
  'src/forms/ct-dob-security-deposit/template/sdcompform-rev-2026.pdf',
);
const OUT_DIR = join(ROOT, 'scripts/out');

interface WidgetInfo {
  page: number | null; // 1-based
  rect: { x: number; y: number; width: number; height: number };
  onValue: string | null;
  appearanceStates: string[];
}

interface FieldInfo {
  name: string;
  type: string;
  tooltip: string | null;
  readOnly: boolean;
  required: boolean;
  multiline?: boolean;
  maxLength?: number | null;
  combed?: boolean;
  options?: string[];
  widgets: WidgetInfo[];
}

const round = (n: number) => Math.round(n * 100) / 100;

function fieldType(field: PDFField): string {
  if (field instanceof PDFTextField) return 'text';
  if (field instanceof PDFCheckBox) return 'checkbox';
  if (field instanceof PDFRadioGroup) return 'radio';
  if (field instanceof PDFDropdown) return 'dropdown';
  if (field instanceof PDFOptionList) return 'listbox';
  if (field instanceof PDFButton) return 'button';
  if (field instanceof PDFSignature) return 'signature';
  return field.constructor.name;
}

function pdfText(value: unknown): string | null {
  if (value instanceof PDFString || value instanceof PDFHexString) return value.decodeText();
  return null;
}

function appearanceStates(widget: PDFWidgetAnnotation): string[] {
  const normal = widget.getAppearances()?.normal;
  if (!(normal instanceof PDFDict)) return [];
  return normal
    .keys()
    .map((key) => key.decodeText())
    .sort();
}

async function main() {
  const pdfPath = process.argv[2] ?? DEFAULT_PDF;
  const doc = await PDFDocument.load(readFileSync(pdfPath), { updateMetadata: false });
  const pages = doc.getPages();

  // Map each annotation dict to its 1-based page number.
  const pageOfAnnot = new Map<PDFDict, number>();
  pages.forEach((page, index) => {
    const annots = page.node.Annots();
    if (!annots) return;
    for (let i = 0; i < annots.size(); i++) {
      const entry = annots.get(i);
      const dict = entry instanceof PDFRef ? doc.context.lookup(entry) : entry;
      if (dict instanceof PDFDict) pageOfAnnot.set(dict, index + 1);
    }
  });

  const acroForm = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  const form = doc.getForm();

  const fields: FieldInfo[] = form.getFields().map((field) => {
    const acro = field.acroField;
    const info: FieldInfo = {
      name: field.getName(),
      type: fieldType(field),
      tooltip: pdfText(acro.dict.lookup(PDFName.of('TU'))),
      readOnly: field.isReadOnly(),
      required: field.isRequired(),
      widgets: acro.getWidgets().map((widget) => {
        const r = widget.getRectangle();
        return {
          page: pageOfAnnot.get(widget.dict) ?? null,
          rect: { x: round(r.x), y: round(r.y), width: round(r.width), height: round(r.height) },
          onValue: widget.getOnValue()?.decodeText() ?? null,
          appearanceStates: appearanceStates(widget),
        };
      }),
    };
    if (field instanceof PDFTextField) {
      info.multiline = field.isMultiline();
      info.maxLength = field.getMaxLength() ?? null;
      info.combed = field.isCombed();
    }
    if (
      field instanceof PDFRadioGroup ||
      field instanceof PDFDropdown ||
      field instanceof PDFOptionList
    ) {
      info.options = field.getOptions();
    }
    return info;
  });

  // Reading order: page, then top to bottom, then left to right.
  const firstWidget = (f: FieldInfo) => f.widgets[0];
  fields.sort((a, b) => {
    const wa = firstWidget(a);
    const wb = firstWidget(b);
    return (
      (wa?.page ?? 99) - (wb?.page ?? 99) ||
      (wb?.rect.y ?? 0) - (wa?.rect.y ?? 0) ||
      (wa?.rect.x ?? 0) - (wb?.rect.x ?? 0) ||
      a.name.localeCompare(b.name)
    );
  });

  const result = {
    file: basename(pdfPath),
    pageCount: pages.length,
    pages: pages.map((page, index) => ({
      page: index + 1,
      width: round(page.getWidth()),
      height: round(page.getHeight()),
      rotation: page.getRotation().angle,
    })),
    acroForm: {
      present: acroForm !== undefined,
      hasXfa: acroForm?.has(PDFName.of('XFA')) ?? false,
      needAppearances: acroForm?.get(PDFName.of('NeedAppearances'))?.toString() ?? null,
      defaultAppearance: pdfText(acroForm?.lookup(PDFName.of('DA'))),
    },
    fieldCount: fields.length,
    fields,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, 'form-fields.json');
  writeFileSync(outPath, stableJson(result));

  printTable(result.file, result.pages, result.acroForm, fields);
  console.log(`\nJSON written to ${outPath}`);
}

function printTable(
  file: string,
  pages: { page: number; width: number; height: number; rotation: number }[],
  acroForm: Record<string, unknown>,
  fields: FieldInfo[],
) {
  console.log(`File: ${file}`);
  for (const p of pages)
    console.log(`Page ${p.page}: ${p.width} x ${p.height} pt, rotation ${p.rotation}`);
  console.log(`AcroForm: ${JSON.stringify(acroForm)}`);
  console.log(`Fields: ${fields.length}\n`);
  for (const f of fields) {
    const extras = [
      f.multiline ? 'multiline' : '',
      f.maxLength ? `maxLen=${f.maxLength}` : '',
      f.combed ? 'comb' : '',
      f.readOnly ? 'readOnly' : '',
      f.required ? 'required' : '',
      f.options ? `options=[${f.options.join(', ')}]` : '',
      f.tooltip ? `tip="${f.tooltip}"` : '',
    ]
      .filter(Boolean)
      .join(' ');
    console.log(`${f.type.padEnd(9)} ${JSON.stringify(f.name)} ${extras}`);
    for (const w of f.widgets) {
      const { x, y, width, height } = w.rect;
      const states = w.appearanceStates.length ? ` states=[${w.appearanceStates.join(', ')}]` : '';
      const on = w.onValue ? ` on=${w.onValue}` : '';
      console.log(`            p${w.page} x=${x} y=${y} w=${width} h=${height}${on}${states}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
