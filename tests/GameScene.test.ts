import { describe, expect, it } from 'vitest';
import { CONTACT_HIT_COOLDOWN } from '../src/data/combat';
import { ENEMY_TYPES } from '../src/data/enemies';
import { PLAYER_BASE } from '../src/data/player';
import { GameScene, type GameSceneDeps } from '../src/scenes/GameScene';

const DT = 1 / 60;

/** Faux objets à la place du navigateur : on peut "appuyer" sur des touches et lire l'UI. */
function makeDeps() {
  const pressed = new Set<string>();
  const ui = {
    paused: false,
    deathShownWith: null as number | null,
    deathKills: null as number | null,
    restarts: 0,
  };
  const deps: GameSceneDeps = {
    input: {
      isDown: () => false,
      wasPressed: (codes) => codes.some((c) => pressed.has(c)),
    },
    pauseOverlay: { setVisible: (v) => (ui.paused = v) },
    deathOverlay: {
      show: (s, k) => {
        ui.deathShownWith = s;
        ui.deathKills = k;
      },
      hide: () => (ui.deathShownWith = null),
    },
    hud: { setTime: () => {} },
    debug: { setStat: () => {}, showHitboxes: false },
    onRestart: () => ui.restarts++,
  };
  /** Simule un appui unique (vu par une seule update, comme Input.endUpdate). */
  const press = (code: string, scene: GameScene) => {
    pressed.add(code);
    scene.update(DT);
    pressed.clear();
  };
  return { deps, ui, press };
}

/** `armed: false` retire les armes : utile pour tester le contact sans que l'arme tue l'ennemi. */
function newScene({ armed = true } = {}) {
  const ctx = makeDeps();
  const scene = new GameScene(ctx.deps, 1234);
  if (!armed) scene.weapons.length = 0;
  scene.enter();
  return { scene, ...ctx };
}

/** Place un ennemi collé au joueur. */
function enemyOnPlayer(scene: GameScene) {
  const e = scene.enemies.acquire();
  if (!e) throw new Error();
  e.spawn(ENEMY_TYPES.basic, scene.player.x + 5, scene.player.y);
}

describe('GameScene — dégâts et mort', () => {
  it('un ennemi au contact blesse le joueur', () => {
    const { scene } = newScene({ armed: false });
    enemyOnPlayer(scene);
    scene.update(DT);
    expect(scene.player.hp).toBe(PLAYER_BASE.maxHp - ENEMY_TYPES.basic.contactDamage);
  });

  it('plusieurs ennemis au contact : chacun frappe (délais indépendants)', () => {
    const { scene } = newScene({ armed: false });
    for (let i = 0; i < 4; i++) enemyOnPlayer(scene);
    const tank = scene.enemies.acquire();
    tank?.spawn(ENEMY_TYPES.tank, scene.player.x - 5, scene.player.y);
    scene.update(DT);
    expect(scene.player.hp).toBe(
      PLAYER_BASE.maxHp - 4 * ENEMY_TYPES.basic.contactDamage - ENEMY_TYPES.tank.contactDamage,
    );
  });

  it('un même ennemi ne refrappe qu’après CONTACT_HIT_COOLDOWN', () => {
    const { scene } = newScene({ armed: false });
    enemyOnPlayer(scene);
    scene.update(DT);
    const afterFirstHit = scene.player.hp;
    expect(afterFirstHit).toBe(PLAYER_BASE.maxHp - ENEMY_TYPES.basic.contactDamage);

    // Juste avant la fin du délai : pas de nouveau coup.
    const stepsBefore = Math.floor(CONTACT_HIT_COOLDOWN / DT) - 2;
    for (let i = 0; i < stepsBefore; i++) scene.update(DT);
    expect(scene.player.hp).toBe(afterFirstHit);

    // Une fois le délai écoulé : il refrappe.
    for (let i = 0; i < 4; i++) scene.update(DT);
    expect(scene.player.hp).toBe(afterFirstHit - ENEMY_TYPES.basic.contactDamage);
  });

  it('à 0 PV : mort, écran de mort avec le temps survécu, plus rien ne bouge', () => {
    const { scene, ui } = newScene();
    for (let i = 0; i < 30; i++) scene.update(DT); // un peu de temps de survie
    scene.player.hp = 1;
    enemyOnPlayer(scene);
    scene.update(DT);
    expect(scene.isDead).toBe(true);
    expect(ui.deathShownWith).toBeGreaterThan(0);

    const x = scene.player.x;
    const count = scene.enemies.activeCount;
    for (let i = 0; i < 120; i++) scene.update(DT);
    expect(scene.player.x).toBe(x);
    expect(scene.enemies.activeCount).toBe(count); // plus de spawn
  });

  it('R après la mort demande à rejouer ; R avant la mort ne fait rien', () => {
    const { scene, ui, press } = newScene();
    press('KeyR', scene);
    expect(ui.restarts).toBe(0);

    scene.player.hp = 1;
    enemyOnPlayer(scene);
    scene.update(DT);
    press('KeyR', scene);
    expect(ui.restarts).toBe(1);
  });

  it('la pause est désactivée après la mort', () => {
    const { scene, ui, press } = newScene();
    scene.player.hp = 1;
    enemyOnPlayer(scene);
    scene.update(DT);
    press('Escape', scene);
    expect(ui.paused).toBe(false);
  });
});

describe('GameScene — combat', () => {
  it('l’arme tue un ennemi proche et le kill est compté', () => {
    const { scene } = newScene();
    scene.enemies.acquire()?.spawn(ENEMY_TYPES.fast, 200, 0);
    for (let i = 0; i < 60; i++) scene.update(DT);
    expect(scene.kills).toBeGreaterThanOrEqual(1);
    expect(scene.weapons[0]?.kills).toBe(scene.kills);
  });

  it('l’écran de mort affiche les kills', () => {
    const { scene, ui } = newScene();
    scene.enemies.acquire()?.spawn(ENEMY_TYPES.basic, 200, 0);
    for (let i = 0; i < 60; i++) scene.update(DT);
    scene.player.hp = 1;
    enemyOnPlayer(scene);
    scene.update(DT);
    expect(scene.isDead).toBe(true);
    expect(ui.deathKills).toBe(scene.kills);
  });
});

describe('GameScene — rejouer sans fuite d’état', () => {
  it('une nouvelle scène repart de zéro, même après une partie chargée', () => {
    const first = newScene();
    for (let i = 0; i < 600; i++) first.scene.update(DT); // 10 s de jeu
    first.scene.player.hp = 1;
    enemyOnPlayer(first.scene);
    first.scene.update(DT);
    expect(first.scene.isDead).toBe(true);

    // "Rejouer" = nouvelle scène, mêmes objets d'UI partagés que la précédente.
    first.scene.exit();
    const second = new GameScene(first.deps, 99);
    second.enter();
    expect(first.ui.deathShownWith).toBeNull(); // écran de mort masqué
    expect(first.ui.paused).toBe(false);
    expect(second.isDead).toBe(false);
    expect(second.player.hp).toBe(PLAYER_BASE.maxHp);
    expect(second.player.x).toBe(0);
    expect(second.enemies.activeCount).toBe(0);
    expect(second.projectiles.activeCount).toBe(0);
    expect(second.kills).toBe(0);
    expect(second.weapons[0]?.totalDamage).toBe(0);
  });

  it('même seed → même partie (reproductible)', () => {
    const run = () => {
      const { scene } = newScene();
      for (let i = 0; i < 300; i++) scene.update(DT);
      return scene.enemies.items.filter((e) => e.active).map((e) => [e.x, e.y, e.type.id]);
    };
    expect(run()).toEqual(run());
  });
});

describe('GameScene — onglet caché', () => {
  it('met la partie en pause', () => {
    const { scene, ui } = newScene();
    scene.onHidden();
    expect(scene.isPaused).toBe(true);
    expect(ui.paused).toBe(true);
  });

  it('ne met pas en pause un joueur mort (l’écran de mort reste)', () => {
    const { scene, ui } = newScene();
    scene.player.hp = 1;
    enemyOnPlayer(scene);
    scene.update(DT);
    scene.onHidden();
    expect(ui.paused).toBe(false);
  });
});
