import { describe, expect, it } from 'vitest';
import { formatNumber } from '../src/ui/formatNumber';

/** Espace insécable entre les milliers */
const S = ' ';

describe('formatNumber', () => {
  it('espace les milliers', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1000)).toBe(`1${S}000`);
    expect(formatNumber(12345)).toBe(`12${S}345`);
    expect(formatNumber(1234567)).toBe(`1${S}234${S}567`);
  });

  it('virgule décimale, sans décimale inutile', () => {
    expect(formatNumber(1.5, 1)).toBe('1,5');
    expect(formatNumber(1.5)).toBe('2');
    expect(formatNumber(2.0, 1)).toBe('2');
    expect(formatNumber(1234.56, 1)).toBe(`1${S}234,6`);
  });

  it('nombres négatifs et zéro', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(-1234)).toBe(`-1${S}234`);
  });
});
