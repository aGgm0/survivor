import { describe, expect, it } from 'vitest';
import { clipFrameIndex, parseEffectManifest } from '../src/core/EffectSheet';

function frame(x: number, ms: number, bounds: number[] | null): unknown {
  return {
    duration: { numerator_ms: ms, denominator: 1 },
    visible_bounds: bounds,
    sheet: { x, y: 0, width: 10, height: 10 },
  };
}

const manifest = {
  source_size: [10, 10],
  pivot: [5, 8],
  loop_mode: 'none',
  frames: [frame(0, 50, [2, 3, 6, 7]), frame(10, 100, null), frame(20, 50, [1, 4, 9, 6])],
};

describe('parseEffectManifest', () => {
  it('lit le cadre, le pivot, les images et la zone visible totale', () => {
    const clip = parseEffectManifest(manifest);
    expect(clip.width).toBe(10);
    expect(clip.pivotY).toBe(8);
    expect(clip.loop).toBe(false);
    expect(clip.frames).toHaveLength(3);
    expect(clip.frames[1]?.bounds).toBeNull();
    expect(clip.totalMs).toBe(200);
    expect(clip.bounds).toEqual([1, 3, 9, 7]);
  });

  it('refuse un manifeste incomplet', () => {
    expect(() => parseEffectManifest({ source_size: [10, 10] })).toThrow();
    expect(() => parseEffectManifest(null)).toThrow();
    expect(() => parseEffectManifest({ ...manifest, pivot: ['a', 2] })).toThrow();
  });
});

describe('clipFrameIndex', () => {
  const clip = parseEffectManifest(manifest);

  it('suit la durée propre de chaque image', () => {
    expect(clipFrameIndex(clip, 0)).toBe(0);
    expect(clipFrameIndex(clip, 60)).toBe(1);
    expect(clipFrameIndex(clip, 160)).toBe(2);
  });

  it('reste sur la dernière image sans boucle, recommence en boucle', () => {
    expect(clipFrameIndex(clip, 1000)).toBe(2);
    expect(clipFrameIndex({ ...clip, loop: true }, 210)).toBe(0);
  });

  it('accélère avec speed', () => {
    expect(clipFrameIndex(clip, 30, 2)).toBe(1);
  });
});
