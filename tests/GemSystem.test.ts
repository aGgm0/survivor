import { describe, expect, it } from 'vitest';
import { GEM_POOL_SIZE, RELOCATED_GEM_XP_FACTOR } from '../src/data/xp';
import { GemSystem } from '../src/systems/GemSystem';

const DT = 1 / 60;
const PLAYER = { x: 0, y: 0, radius: 16, pickupRadius: 60 };

/** Simule `seconds` secondes et renvoie l'XP totale ramassée. */
function run(gems: GemSystem, seconds: number, collector = PLAYER): number {
  let xp = 0;
  for (let i = 0; i < Math.round(seconds / DT); i++) xp += gems.update(DT, collector);
  return xp;
}

describe('GemSystem — aimant et ramassage', () => {
  it('une gemme hors du rayon de ramassage ne bouge pas', () => {
    const gems = new GemSystem();
    gems.drop(200, 0, 1, 0, 0);
    expect(run(gems, 2)).toBe(0);
    const g = gems.gems.items.find((x) => x.active);
    expect(g?.x).toBe(200);
  });

  it('une gemme dans le rayon est attirée puis ramassée', () => {
    const gems = new GemSystem();
    gems.drop(50, 0, 5, 0, 0);
    expect(run(gems, 1)).toBe(5);
    expect(gems.gems.activeCount).toBe(0);
  });

  it('une gemme attirée rattrape le joueur même s’il s’éloigne (plus vite que lui)', () => {
    const gems = new GemSystem();
    gems.drop(55, 0, 1, 0, 0);
    const fleeing = { ...PLAYER };
    let xp = 0;
    for (let i = 0; i < 180 && xp === 0; i++) {
      fleeing.x -= 200 * DT; // le joueur fuit à sa vitesse max
      xp += gems.update(DT, fleeing);
    }
    expect(xp).toBe(1);
  });

  it('ramasse plusieurs gemmes et additionne leur valeur', () => {
    const gems = new GemSystem();
    gems.drop(30, 0, 1, 0, 0);
    gems.drop(-40, 10, 5, 0, 0);
    gems.drop(0, 45, 1, 0, 0);
    expect(run(gems, 1)).toBe(7);
  });
});

describe('GemSystem — réserve pleine', () => {
  it('la gemme la plus éloignée du joueur est déplacée sur le kill, avec la nouvelle XP', () => {
    const gems = new GemSystem();
    // Joueur en (0, 0) ; gemmes de x = 1000 à 1999 : la plus lointaine est en 1999.
    for (let i = 0; i < GEM_POOL_SIZE; i++) gems.drop(1000 + i, 0, 1, 0, 0);
    gems.drop(100, 0, 5, 0, 0); // réserve pleine, kill près du joueur

    expect(gems.gems.activeCount).toBe(GEM_POOL_SIZE);
    const atKill = gems.gems.items.filter((g) => g.active && g.x === 100);
    expect(atKill).toHaveLength(1);
    // L'ancienne gemme (1 XP) est pénalisée, la nouvelle XP (5) reste entière.
    expect(atKill[0]?.value).toBe(1 * RELOCATED_GEM_XP_FACTOR + 5);
    expect(gems.gems.items.some((g) => g.active && g.x === 1999)).toBe(false);
  });

  it('seule l’XP déplacée est pénalisée : le total au sol baisse exactement de la pénalité', () => {
    const gems = new GemSystem();
    for (let i = 0; i < GEM_POOL_SIZE; i++) gems.drop(1000 + i, 0, 1, 0, 0);
    for (let i = 0; i < 50; i++) gems.drop(100, i, 5, 0, 0); // 50 gemmes lointaines déplacées
    const total = gems.gems.items.reduce((sum, g) => sum + (g.active ? g.value : 0), 0);
    const penalty = 50 * 1 * (1 - RELOCATED_GEM_XP_FACTOR);
    expect(total).toBeCloseTo(GEM_POOL_SIZE + 50 * 5 - penalty);
  });

  it('ne déplace pas une gemme déjà attirée vers le joueur', () => {
    const gems = new GemSystem();
    for (let i = 0; i < GEM_POOL_SIZE; i++) gems.drop(1000 + i, 0, 1, 0, 0);
    // Le joueur est près de la gemme la plus lointaine (1999) : elle est attirée.
    const nearFar = { x: 2030, y: 0, radius: 16, pickupRadius: 60 };
    gems.update(DT, nearFar);
    const attracted = gems.gems.items.find((g) => g.attracted);
    // Nouveau kill, joueur considéré en (0, 0) : la plus lointaine non attirée est en 1998.
    gems.drop(100, 0, 5, 0, 0);
    expect(attracted?.active).toBe(true);
    expect(attracted?.x).not.toBe(100);
  });
});
