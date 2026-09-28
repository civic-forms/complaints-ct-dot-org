// Phase 1 / §5.3: extract a form PDF's printed text and check verbatim.json
// against it. Dev-only (pdfjs-dist is a devDependency; the app never loads it).
//
//   pnpm form:text [path/to/form.pdf]
//
// Defaults to the committed template. Prints every text line with its position,
// then MATCH / MISMATCH for each verbatim.json string (with a word-level diff
// against the closest passage). Writes stable JSON to scripts/out/form-text.json.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { stableJson } from './lib/stable-json.ts';

const ROOT = join(import.meta.dirname, '..');
const FORM_DIR = join(ROOT, 'src/forms/ct-dob-security-deposit');
const DEFAULT_PDF = join(FORM_DIR, 'template/sdcompform-rev-2026.pdf');
const VERBATIM = join(FORM_DIR, 'verbatim.json');
const OUT_DIR = join(ROOT, 'scripts/out');

interface TextLine {
  page: number;
  x: number;
  y: number;
  text: string;
}

const round = (n: number) => Math.round(n * 100) / 100;

// Items whose baselines are within this many points form one line.
const LINE_TOLERANCE = 2;

async function extractLines(pdfPath: string): Promise<TextLine[]> {
  const data = new Uint8Array(readFileSync(pdfPath));
  const loadingTask = getDocument({ data, useSystemFonts: false, verbosity: 0 });
  const doc = await loadingTask.promise;
  const lines: TextLine[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items
      .filter((item) => 'str' in item && item.str.trim() !== '')
      .map((item) => {
        const { str, transform, width } = item as {
          str: string;
          transform: number[];
          width: number;
        };
        return { x: transform[4] ?? 0, y: transform[5] ?? 0, width, str };
      })
      .sort((a, b) => b.y - a.y || a.x - b.x);

    const pageLines: { y: number; items: typeof items }[] = [];
    for (const item of items) {
      const line = pageLines.find((l) => Math.abs(l.y - item.y) <= LINE_TOLERANCE);
      if (line) line.items.push(item);
      else pageLines.push({ y: item.y, items: [item] });
    }
    for (const line of pageLines) {
      line.items.sort((a, b) => a.x - b.x);
      let text = '';
      let lastEnd: number | null = null;
      for (const item of line.items) {
        // Skip runs mostly covered by the previous run: the template overprints
        // some text (e.g. the page footers), which would otherwise read twice.
        // A small overlap is just trailing space, as on the Signature/Date line.
        if (lastEnd !== null && lastEnd - item.x > item.width / 2) continue;
        // Insert a space where there's a visible gap between items.
        if (
          lastEnd !== null &&
          item.x - lastEnd > 1 &&
          !text.endsWith(' ') &&
          !item.str.startsWith(' ')
        ) {
          text += ' ';
        }
        text += item.str;
        lastEnd = item.x + item.width;
      }
      const first = line.items[0];
      lines.push({
        page: pageNumber,
        x: round(first?.x ?? 0),
        y: round(line.y),
        text: text.trim(),
      });
    }
  }
  await loadingTask.destroy();
  return lines;
}

// Normalization for comparison only: collapse whitespace and rejoin words the
// layout hyphenated across lines. The printed characters (quotes, apostrophes,
// punctuation) are compared as-is.
function normalize(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/(\w)- (\w)/g, '$1-$2')
    .trim();
}

function flattenStrings(value: unknown, path: string, out: { path: string; text: string }[]) {
  if (typeof value === 'string') out.push({ path, text: value });
  else if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) flattenStrings(v, `${path}[${i}]`, out);
  } else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value))
      flattenStrings(v, path ? `${path}.${key}` : key, out);
  }
}

// Word-level LCS diff: "-word" is in verbatim.json but not the PDF, "+word" the reverse.
function wordDiff(expected: string[], actual: string[]): string[] {
  const n = expected.length;
  const m = actual.length;
  const width = m + 1;
  const lcs = new Uint32Array((n + 1) * width);
  const at = (i: number, j: number) => lcs[i * width + j] ?? 0;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * width + j] =
        expected[i] === actual[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const diff: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (expected[i] === actual[j]) {
      i++;
      j++;
    } else if (at(i + 1, j) >= at(i, j + 1)) diff.push(`-${expected[i++]}`);
    else diff.push(`+${actual[j++]}`);
  }
  while (i < n) diff.push(`-${expected[i++]}`);
  while (j < m) diff.push(`+${actual[j++]}`);
  return diff;
}

function closestPassage(expected: string[], pageWords: string[]) {
  let best = { score: -1, start: 0, end: 0 };
  const firstWords = new Set(expected.slice(0, 3));
  for (let start = 0; start < pageWords.length; start++) {
    if (!firstWords.has(pageWords[start] as string)) continue;
    const end = Math.min(pageWords.length, start + expected.length + 5);
    const window = pageWords.slice(start, end);
    const matched = window.length + expected.length - wordDiff(expected, window).length;
    if (matched > best.score) best = { score: matched, start, end };
  }
  if (best.score < 0) return null;
  // Tighten: drop trailing extra words that only add "+" noise.
  let { end } = best;
  while (end > best.start + 1) {
    const shorter = pageWords.slice(best.start, end - 1);
    const current = pageWords.slice(best.start, end);
    if (wordDiff(expected, shorter).length < wordDiff(expected, current).length) end--;
    else break;
  }
  return pageWords.slice(best.start, end);
}

async function main() {
  const pdfPath = process.argv[2] ?? DEFAULT_PDF;
  const lines = await extractLines(pdfPath);

  console.log(`File: ${basename(pdfPath)}\n`);
  let currentPage = 0;
  for (const line of lines) {
    if (line.page !== currentPage) {
      currentPage = line.page;
      console.log(`\n=== Page ${currentPage} ===`);
    }
    console.log(`${String(line.x).padStart(7)} ${String(line.y).padStart(7)}  ${line.text}`);
  }

  const allText = normalize(lines.map((l) => l.text).join(' '));
  const allWords = allText.split(' ');
  const allTextNoSpaces = allText.replace(/ /g, '');
  const strings: { path: string; text: string }[] = [];
  flattenStrings(JSON.parse(readFileSync(VERBATIM, 'utf8')), '', strings);

  console.log('\n=== verbatim.json check ===');
  const results = strings.map(({ path, text }) => {
    const expected = normalize(text);
    if (allText.includes(expected)) {
      console.log(`MATCH     ${path}`);
      return { path, status: 'match' as const };
    }
    // Fallback: the PDF letter-spaces some words (it extracts "Month-To-Month"
    // as "M onth-To-Month"), so compare with all whitespace removed too.
    if (allTextNoSpaces.includes(expected.replace(/ /g, ''))) {
      console.log(`MATCH*    ${path}  (ignoring spaces)`);
      return { path, status: 'match-ignoring-spaces' as const };
    }
    const passage = closestPassage(expected.split(' '), allWords);
    const diff = passage ? wordDiff(expected.split(' '), passage) : [];
    console.log(`MISMATCH  ${path}`);
    console.log(`          pdf:  ${passage ? passage.join(' ') : '(no similar passage found)'}`);
    if (diff.length) console.log(`          diff: ${diff.join(' ')}`);
    return { path, status: 'mismatch' as const, pdfText: passage?.join(' ') ?? null, diff };
  });

  const mismatches = results.filter((r) => r.status === 'mismatch').length;
  const spaceOnly = results.filter((r) => r.status === 'match-ignoring-spaces').length;
  console.log(
    `\n${results.length - mismatches - spaceOnly} match, ${spaceOnly} match ignoring spaces, ${mismatches} mismatch`,
  );

  mkdirSync(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, 'form-text.json');
  writeFileSync(outPath, stableJson({ file: basename(pdfPath), lines, verbatimCheck: results }));
  console.log(`JSON written to ${outPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
