import { describe, expect, it } from 'vitest';
import { HP_BARS } from '../src/data/feel';
import { updateHpTrail, type HpTrailState } from '../src/systems/hpTrail';

const DT = 1 / 60;
const T = HP_BARS.trail;

function bar(hp: number, maxHp = 100): HpTrailState & { hp: number } {
  return { hp, maxHp, hpTrail: hp, hpTrailHold: 0 };
}

describe('traînée des barres de PV', () => {
  it('reste en place `hold` s après un coup, puis fond jusqu’aux PV', () => {
    const s = bar(100);
    updateHpTrail(s, DT);
    s.hp = 60;
    for (let t = 0; t < T.hold - 0.05; t += DT) updateHpTrail(s, DT);
    expect(s.hpTrail).toBe(100);
    for (let t = 0; t < 2; t += DT) updateHpTrail(s, DT);
    expect(s.hpTrail).toBe(60);
  });

  it('un soin la remet tout de suite sur les PV', () => {
    const s = bar(50);
    s.hpTrail = 80;
    s.hp = 90;
    updateHpTrail(s, DT);
    expect(s.hpTrail).toBe(90);
  });

  it('sous des coups continus, elle fond quand même (le délai ne repart pas à chaque coup)', () => {
    const s = bar(1000, 1000);
    updateHpTrail(s, DT);
    for (let t = 0; t < 3; t += DT) {
      s.hp -= 100 * DT; // 100 PV/s
      updateHpTrail(s, DT);
    }
    expect(s.hpTrail - s.hp).toBeLessThan(60);
  });
});
