import { describe, expect, it } from 'vitest';
import { fakeCanvasContext } from '../sim/fakeCanvas';
import { Pool } from '../src/core/Pool';
import type { SpriteAtlas, SpriteFrame } from '../src/core/SpriteAtlas';
import { ARROW_SPRITE } from '../src/data/sprites';
import { WEAPONS } from '../src/data/weapons';
import { Projectile } from '../src/entities/Projectile';
import { Weapon } from '../src/entities/Weapon';
import { behaviorOf } from '../src/weapons/registry';
import type { WeaponRenderContext } from '../src/weapons/WeaponBehavior';

describe('Arc : les flèches du pack', () => {
  it('chaque flèche en vol est dessinée avec le sprite weapon_arrow, tournée dans le sens du tir', () => {
    const bow = new Weapon(WEAPONS.bow);
    const projectiles = new Pool(4, () => new Projectile());
    projectiles.acquire()?.launch(bow, 1, 0, 0, 0, 1); // tir vers le bas
    const frame: SpriteFrame = { x: 0, y: 0, w: 7, h: 21 };
    const calls: { name: string; angle: number }[] = [];
    const sprites = {
      animation: (name: string) => (name === ARROW_SPRITE.frame ? [frame] : []),
      drawRotated: (_c: unknown, _f: unknown, _x: number, _y: number, _s: number, angle: number) =>
        calls.push({ name: 'arrow', angle }),
    } as unknown as SpriteAtlas;
    const rc: WeaponRenderContext = {
      alpha: 1,
      playerX: 0,
      playerY: 0,
      time: 0,
      fx: null,
      sprites,
      effects: null,
      projectiles,
      isOnScreen: () => true,
    };
    behaviorOf(bow.def).renderAbove?.(fakeCanvasContext(), bow, bow.def, rc);
    expect(calls).toHaveLength(1);
    // Vers le bas (π/2) + le quart de tour du sprite qui pointe en haut.
    expect(calls[0]?.angle).toBeCloseTo(Math.PI / 2 + ARROW_SPRITE.rotation);
  });
});
