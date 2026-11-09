import { describe, expect, it } from 'vitest';
import { formatTime } from '../src/ui/formatTime';

describe('formatTime', () => {
  it('formate en mm:ss avec zéros', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(5)).toBe('00:05');
    expect(formatTime(75.9)).toBe('01:15');
    expect(formatTime(600)).toBe('10:00');
  });

  it('ne descend pas sous zéro', () => {
    expect(formatTime(-3)).toBe('00:00');
  });
});
