import { describe, expect, it } from 'vitest';
import { Player } from '../src/entities/Player';
import { PLAYER_BASE } from '../src/data/player';

const ONE_SECOND_IN_STEPS = 60;
const STEP = 1 / ONE_SECOND_IN_STEPS;

function moveForOneSecond(player: Player, axisX: number, axisY: number): void {
  for (let i = 0; i < ONE_SECOND_IN_STEPS; i++) player.update(STEP, axisX, axisY);
}

describe('Player', () => {
  it('parcourt `speed` px en 1 s en ligne droite', () => {
    const p = new Player();
    moveForOneSecond(p, 1, 0);
    expect(p.x).toBeCloseTo(PLAYER_BASE.speed);
    expect(p.y).toBe(0);
  });

  it("ne va pas plus vite en diagonale qu'en ligne droite", () => {
    const p = new Player();
    moveForOneSecond(p, 1, 1);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(PLAYER_BASE.speed);
  });

  it('ne bouge pas sans direction', () => {
    const p = new Player();
    moveForOneSecond(p, 0, 0);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it('interpole entre la position précédente et actuelle', () => {
    const p = new Player();
    p.update(STEP, 1, 0);
    expect(p.renderX(0)).toBe(p.prevX);
    expect(p.renderX(1)).toBe(p.x);
    expect(p.renderX(0.5)).toBeCloseTo((p.prevX + p.x) / 2);
  });

  describe('régénération', () => {
    it('rend `regen` PV par seconde', () => {
      const p = new Player();
      p.hp = 50;
      moveForOneSecond(p, 0, 0);
      expect(p.hp).toBeCloseTo(50 + PLAYER_BASE.regen);
    });

    it('ne dépasse pas les PV max', () => {
      const p = new Player();
      p.hp = p.maxHp - 0.01;
      moveForOneSecond(p, 0, 0);
      expect(p.hp).toBe(p.maxHp);
    });

    it('ne ressuscite pas un joueur mort', () => {
      const p = new Player();
      p.hp = 0;
      moveForOneSecond(p, 0, 0);
      expect(p.isDead).toBe(true);
    });
  });
});
