import { describe, expect, it } from 'vitest';
import { addTrauma, Camera } from '../src/core/Camera';
import { SHAKE } from '../src/data/feel';

describe('addTrauma', () => {
  it('additionne les chocs sans dépasser 1', () => {
    expect(addTrauma(0.2, 0.3)).toBeCloseTo(0.5);
    expect(addTrauma(0.9, 0.5)).toBe(1);
  });

  it('un choc plafonné ne monte pas au-dessus de son plafond', () => {
    let t = 0;
    for (let i = 0; i < 10; i++) t = addTrauma(t, 0.15, 0.4);
    expect(t).toBeCloseTo(0.4);
  });

  it('un choc plafonné ne fait jamais baisser un trauma déjà plus haut', () => {
    expect(addTrauma(0.7, 0.15, 0.4)).toBe(0.7);
  });
});

describe('Camera — tremblement', () => {
  it('le trauma redescend tout seul jusqu’à zéro', () => {
    const cam = new Camera();
    cam.addTrauma(0.8);
    for (let i = 0; i < 120; i++) cam.updateShake(1 / 60, i / 60, SHAKE);
    expect(cam.trauma).toBe(0);
    expect(cam.shakeX).toBe(0);
    expect(cam.shakeY).toBe(0);
  });

  it('décalage borné par trauma² × maxOffset', () => {
    const cam = new Camera();
    cam.addTrauma(0.5);
    for (let i = 0; i < 30; i++) {
      cam.updateShake(1 / 60, i / 60, SHAKE);
      const max = cam.trauma * cam.trauma * SHAKE.maxOffset;
      expect(Math.abs(cam.shakeX)).toBeLessThanOrEqual(max + 1e-9);
      expect(Math.abs(cam.shakeY)).toBeLessThanOrEqual(max + 1e-9);
    }
  });

  it('resetShake coupe tout', () => {
    const cam = new Camera();
    cam.addTrauma(1);
    cam.updateShake(1 / 60, 0.3, SHAKE);
    cam.resetShake();
    expect([cam.trauma, cam.shakeX, cam.shakeY]).toEqual([0, 0, 0]);
  });
});
