import { describe, expect, it } from 'vitest';
import { Camera } from '../src/core/Camera';
import { Rng } from '../src/core/math';
import type { SfxName } from '../src/data/audio';
import { ENEMY_TYPES } from '../src/data/enemies';
import { PARTICLES, RESISTED_NUMBERS } from '../src/data/feel';
import { DEFAULT_SETTINGS } from '../src/data/settings';
import { WEAPONS } from '../src/data/weapons';
import { Enemy } from '../src/entities/Enemy';
import { Weapon } from '../src/entities/Weapon';
import { Feedback } from '../src/scenes/game/Feedback';
import { DamageNumberSystem } from '../src/systems/DamageNumberSystem';
import { EffectsSystem } from '../src/systems/EffectsSystem';
import { ParticleSystem } from '../src/systems/ParticleSystem';

function setup() {
  const played: SfxName[] = [];
  const camera = new Camera();
  const particles = new ParticleSystem(PARTICLES.poolSize, new Rng(1), PARTICLES.drag);
  const damageNumbers = new DamageNumberSystem(new Rng(2));
  const settings = { ...DEFAULT_SETTINGS, damageNumbers: true };
  const feedback = new Feedback(
    {
      camera,
      particles,
      effects: new EffectsSystem(null, null),
      damageNumbers,
      settings: () => settings,
      sfx: { play: (name) => played.push(name) },
      now: () => 10,
    },
    3,
  );
  return { feedback, played, camera, particles, damageNumbers, settings };
}

describe('Feedback (son, tremblement, particules)', () => {
  it('un coup : son de l’arme, flash et nombre de dégâts', () => {
    const { feedback, played, damageNumbers } = setup();
    const e = new Enemy();
    e.type = ENEMY_TYPES.basic;
    feedback.enemyHit(e, 12, 'direct', new Weapon(WEAPONS.runicOrbs), 0);
    expect(played).toEqual(['orb-hit']);
    expect(e.flashUntil).toBeGreaterThan(10);
    expect(damageNumbers.numbers.activeCount).toBe(1);
  });

  it('le poison : ni son ni flash ; nombres coupés dans les Options', () => {
    const { feedback, played, damageNumbers, settings } = setup();
    const e = new Enemy();
    feedback.enemyHit(e, 3, 'poison', new Weapon(WEAPONS.burningAura), 0);
    expect(played).toEqual([]);
    expect(e.flashUntil).toBeLessThan(10);
    settings.damageNumbers = false;
    feedback.enemyHit(e, 3, 'poison', new Weapon(WEAPONS.burningAura), 0);
    expect(damageNumbers.numbers.activeCount).toBe(1);
  });

  it('un coup bien réduit par la résistance : nombre gris ; un coup à peine réduit : blanc', () => {
    const { feedback, damageNumbers } = setup();
    const e = new Enemy();
    const bolt = new Weapon(WEAPONS.arcaneBolt);
    feedback.enemyHit(e, 12, 'direct', bolt, 0.33);
    feedback.enemyHit(e, 12, 'direct', bolt, 0.09);
    const colors = damageNumbers.numbers.items.filter((n) => n.active).map((n) => n.color);
    expect(colors).toEqual([RESISTED_NUMBERS.color, '#ffffff']);
  });

  it('la mort du boss : son du boss, gros tremblement, gerbe d’éclats', () => {
    const { feedback, played, camera, particles } = setup();
    const boss = new Enemy();
    boss.type = ENEMY_TYPES.boss;
    feedback.enemyKilled(boss);
    expect(played).toEqual(['boss-death']);
    expect(camera.trauma).toBeGreaterThan(0.5);
    expect(particles.activeCount).toBeGreaterThan(0);
  });
});
