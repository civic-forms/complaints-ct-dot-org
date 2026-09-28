import { describe, expect, it } from 'vitest';
import { formatDateMMDDYY, isIsoDate, todayIso } from '../../src/core/format/date.ts';
import { formatCents, parseMoneyToCents } from '../../src/core/format/money.ts';
import { formatPhone } from '../../src/core/format/phone.ts';

describe('formatDateMMDDYY', () => {
  it.each([
    ['2026-03-05', '03/05/26'],
    ['2000-01-01', '01/01/00'],
    ['2009-12-31', '12/31/09'],
    ['2099-07-04', '07/04/99'],
    ['2024-02-29', '02/29/24'],
  ])('%s → %s', (iso, expected) => {
    expect(formatDateMMDDYY(iso)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    '',
    '2026-13-01',
    '2026-02-30',
    '2025-02-29',
    '03/05/2026',
    '2026-3-5',
  ])('returns "" for %s', (value) => {
    expect(formatDateMMDDYY(value)).toBe('');
  });

  it('validates ISO dates', () => {
    expect(isIsoDate('2026-09-27')).toBe(true);
    expect(isIsoDate('2026-09-31')).toBe(false);
  });

  it('todayIso uses local date parts', () => {
    expect(todayIso(new Date(2026, 0, 9, 23, 59))).toBe('2026-01-09');
  });
});

describe('money', () => {
  it.each([
    [125000, '$1,250.00'],
    [0, '$0.00'],
    [5, '$0.05'],
    [123456789, '$1,234,567.89'],
    [null, ''],
  ])('formatCents(%s) → %s', (cents, expected) => {
    expect(formatCents(cents)).toBe(expected);
  });

  it.each([
    ['1,250', 125000],
    ['$1250.5', 125050],
    ['$ 1,250.05', 125005],
    [' 12 ', 1200],
    ['.5', 50],
    ['0', 0],
  ])('parses %s', (input, cents) => {
    expect(parseMoneyToCents(input)).toBe(cents);
  });

  it.each(['', 'abc', '12.345', '-5', '1.2.3', '$', '12a'])('rejects %s', (input) => {
    expect(parseMoneyToCents(input)).toBeNull();
  });
});

describe('formatPhone', () => {
  it.each([
    ['8605550123', '(860) 555-0123'],
    ['860-555-0123', '(860) 555-0123'],
    ['(860) 555 0123', '(860) 555-0123'],
    ['Unknown', 'Unknown'],
    ['1-800-831-7225', '1-800-831-7225'],
    ['+1 860 555 0123', '+1 860 555 0123'],
    ['860-555-0123 ext 4', '860-555-0123 ext 4'],
    ['555-0123', '555-0123'],
  ])('%s → %s', (input, expected) => {
    expect(formatPhone(input)).toBe(expected);
  });
});
