import { describe, expect, it } from 'vitest';
import {
  budgetStatus,
  CAP_BYTES,
  largestAttachments,
  pageBucket,
  pdfShare,
  sizeBucket,
  WARN_BYTES,
} from '../../src/core/pdf/budget.ts';

const MB = 1024 * 1024;

describe('size budget', () => {
  it('warns above 8 MB and is over the cap above 10 MB', () => {
    expect(budgetStatus(WARN_BYTES)).toBe('ok');
    expect(budgetStatus(WARN_BYTES + 1)).toBe('warn');
    expect(budgetStatus(CAP_BYTES)).toBe('warn');
    expect(budgetStatus(CAP_BYTES + 1)).toBe('over');
  });

  it('lists the largest attachments first', () => {
    const items = [{ bytes: 1 }, { bytes: 30 }, { bytes: 20 }];
    expect(largestAttachments(items, 2).map((i) => i.bytes)).toEqual([30, 20]);
  });

  it.each([
    [0, 'lt2mb'],
    [2 * MB - 1, 'lt2mb'],
    [2 * MB, '2to5mb'],
    [5 * MB, '5to8mb'],
    [8 * MB, '8to10mb'],
    [10 * MB, '8to10mb'],
    [10 * MB + 1, 'over10mb'],
  ])('sizeBucket(%d) = %s', (bytes, bucket) => {
    expect(sizeBucket(bytes)).toBe(bucket);
  });

  it.each([
    [4, 'lt10'],
    [9, 'lt10'],
    [10, '10to20'],
    [20, '10to20'],
    [21, '20to40'],
    [40, '20to40'],
    [41, 'gt40'],
  ])('pageBucket(%d) = %s', (pages, bucket) => {
    expect(pageBucket(pages)).toBe(bucket);
  });
});

describe('pdfShare', () => {
  it('is the share of attachment bytes that are PDFs', () => {
    expect(pdfShare([])).toBe(0);
    expect(
      pdfShare([
        { kind: 'pdf', bytes: 3 * MB },
        { kind: 'image', bytes: 1 * MB },
      ]),
    ).toBe(0.75);
    expect(pdfShare([{ kind: 'image', bytes: MB }])).toBe(0);
  });
});
