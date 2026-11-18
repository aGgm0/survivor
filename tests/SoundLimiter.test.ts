import { describe, expect, it } from 'vitest';
import { SoundLimiter, jitteredRate } from '../src/core/SoundLimiter';
import { SFX } from '../src/data/audio';

const settings = { volume: 1, minGap: 0.05, maxVoices: 2, pitchJitter: 0 };

describe('SoundLimiter', () => {
  it('ignore les demandes trop rapprochées (30 coups dans la même frame = 1 son)', () => {
    const limiter = new SoundLimiter(settings);
    let started = 0;
    for (let i = 0; i < 30; i++) if (limiter.tryStart(1, 0.05)) started++;
    expect(started).toBe(1);
  });

  it('rejoue le son une fois le délai minimum passé', () => {
    const limiter = new SoundLimiter(settings);
    expect(limiter.tryStart(1, 0.01)).toBe(true);
    expect(limiter.tryStart(1.04, 0.01)).toBe(false);
    expect(limiter.tryStart(1.05, 0.01)).toBe(true);
  });

  it('ne dépasse jamais le nombre de copies simultanées', () => {
    const limiter = new SoundLimiter(settings);
    // Son long (1 s) demandé toutes les 0,1 s : 2 copies max, puis une place se libère à 2 s.
    expect(limiter.tryStart(1, 1)).toBe(true);
    expect(limiter.tryStart(1.1, 1)).toBe(true);
    expect(limiter.tryStart(1.2, 1)).toBe(false);
    expect(limiter.tryStart(1.9, 1)).toBe(false);
    expect(limiter.tryStart(2, 1)).toBe(true);
  });

  it('sans délai minimum, plusieurs copies peuvent partir ensemble', () => {
    const limiter = new SoundLimiter({ ...settings, minGap: 0 });
    expect(limiter.tryStart(1, 0.5)).toBe(true);
    expect(limiter.tryStart(1, 0.5)).toBe(true);
    expect(limiter.tryStart(1, 0.5)).toBe(false);
  });
});

describe('jitteredRate', () => {
  it('reste dans ±jitter autour de 1', () => {
    expect(jitteredRate(0.06, 0)).toBeCloseTo(0.94);
    expect(jitteredRate(0.06, 0.5)).toBeCloseTo(1);
    expect(jitteredRate(0.06, 1)).toBeCloseTo(1.06);
    expect(jitteredRate(0, 0.9)).toBe(1);
  });
});

describe('SFX (data/audio.ts)', () => {
  it('les sons fréquents sont plus bas et limités que les sons importants', () => {
    for (const name of ['enemy-hit', 'enemy-death', 'aura-burn', 'gem-pickup'] as const) {
      expect(SFX[name].volume).toBeLessThan(SFX['player-hurt'].volume);
      expect(SFX[name].minGap).toBeGreaterThan(0);
    }
  });

  it('tous les réglages sont valides', () => {
    for (const s of Object.values(SFX)) {
      expect(s.volume).toBeGreaterThan(0);
      expect(s.volume).toBeLessThanOrEqual(1);
      expect(s.maxVoices).toBeGreaterThanOrEqual(1);
      expect(s.pitchJitter).toBeLessThan(0.5);
    }
  });
});
