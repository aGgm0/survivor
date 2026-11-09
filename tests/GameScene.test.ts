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
    levelUpShown: null as { level: number; titles: string[] } | null,
    /** Clic simulé sur une carte de level up (lu une fois par la scène) */
    click: null as number | null,
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
    levelUpOverlay: {
      show: (level, choices) => (ui.levelUpShown = { level, titles: choices.map((c) => c.title) }),
      hide: () => (ui.levelUpShown = null),
      takeClick: () => {
        const c = ui.click;
        ui.click = null;
        return c;
      },
    },
    hud: { setTime: () => {}, setProgress: () => {} },
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

  it('un ennemi touché flashe et un nombre de dégâts apparaît', () => {
    const { scene } = newScene();
    const tank = scene.enemies.acquire();
    tank?.spawn(ENEMY_TYPES.tank, 200, 0);
    let flashed = false;
    for (let i = 0; i < 60 && !flashed; i++) {
      scene.update(DT);
      flashed = (tank?.flashUntil ?? 0) > 0;
    }
    expect(flashed).toBe(true);
    expect(scene.damageNumbers.numbers.activeCount).toBeGreaterThan(0);
  });

  it('un ennemi tué lâche sa gemme ; la ramasser donne son XP', () => {
    const { scene } = newScene();
    scene.enemies.acquire()?.spawn(ENEMY_TYPES.fast, 200, 0);
    for (let i = 0; i < 60 && scene.kills === 0; i++) scene.update(DT);
    expect(scene.kills).toBe(1);
    const gem = scene.gems.gems.items.find((g) => g.active);
    if (!gem) throw new Error('pas de gemme');
    expect(gem.value).toBe(ENEMY_TYPES.fast.xp);

    // Le joueur va vers la gemme : l'aimant fait le reste.
    scene.player.x = gem.x - 40;
    scene.player.y = gem.y;
    for (let i = 0; i < 60; i++) scene.update(DT);
    expect(scene.progression.totalXp).toBe(ENEMY_TYPES.fast.xp);
    expect(scene.gems.gems.activeCount).toBe(0);
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

describe('GameScene — level up', () => {
  /** Pose une gemme sous le joueur et laisse l'aimant la ramasser. */
  function giveXp(scene: GameScene, amount: number) {
    scene.gems.drop(scene.player.x + 5, scene.player.y, amount, scene.player.x, scene.player.y);
    for (let i = 0; i < 30 && !scene.isChoosingUpgrade; i++) scene.update(DT);
  }

  it('assez d’XP : le jeu se fige et 3 choix s’affichent', () => {
    const { scene, ui } = newScene({ armed: false });
    giveXp(scene, 15);
    expect(scene.progression.level).toBe(2);
    expect(scene.isChoosingUpgrade).toBe(true);
    expect(ui.levelUpShown?.level).toBe(2);
    expect(ui.levelUpShown?.titles).toHaveLength(3);

    // Pendant le choix, le temps ne passe pas et rien ne bouge.
    const e = scene.enemies.acquire();
    e?.spawn(ENEMY_TYPES.basic, 300, 0);
    const timeBefore = scene.player.x;
    for (let i = 0; i < 60; i++) scene.update(DT);
    expect(e?.x).toBe(300);
    expect(scene.player.x).toBe(timeBefore);
  });

  it('touche 1 : applique le 1er choix et reprend la partie', () => {
    const { scene, ui, press } = newScene({ armed: false });
    giveXp(scene, 15);
    const first = scene.currentChoices[0];
    press('Digit1', scene);
    expect(scene.isChoosingUpgrade).toBe(false);
    expect(ui.levelUpShown).toBeNull();
    if (first?.kind === 'passive') expect(scene.passiveLevels.get(first.passive.id)).toBe(1);
  });

  it('un clic sur une carte marche aussi', () => {
    const { scene, ui } = newScene({ armed: false });
    giveXp(scene, 15);
    ui.click = 2;
    scene.update(DT);
    expect(scene.isChoosingUpgrade).toBe(false);
  });

  it('plusieurs niveaux d’un coup : les écrans s’enchaînent', () => {
    const { scene, ui, press } = newScene({ armed: false });
    giveXp(scene, 15 + 25); // niveaux 2 et 3
    expect(scene.progression.level).toBe(3);
    expect(ui.levelUpShown?.level).toBe(2);
    press('Digit1', scene);
    expect(scene.isChoosingUpgrade).toBe(true);
    expect(ui.levelUpShown?.level).toBe(3);
    press('Digit2', scene);
    expect(scene.isChoosingUpgrade).toBe(false);
  });

  it('Échap ne met pas en pause pendant le choix', () => {
    const { scene, ui, press } = newScene({ armed: false });
    giveXp(scene, 15);
    press('Escape', scene);
    expect(ui.paused).toBe(false);
    expect(scene.isChoosingUpgrade).toBe(true);
  });

  it('monter le Trait arcanique change vraiment ses dégâts', () => {
    const { scene, press } = newScene();
    // On rejoue jusqu'à tomber sur le choix de l'arme (les choix sont tirés au hasard).
    for (let attempt = 0; attempt < 20 && scene.weapons[0]?.level === 1; attempt++) {
      giveXp(scene, scene.progression.xpForNext);
      const index = scene.currentChoices.findIndex((c) => c.kind === 'weaponLevel');
      press(index >= 0 ? `Digit${index + 1}` : 'Digit1', scene);
    }
    expect(scene.weapons[0]?.level).toBe(2);
    expect(scene.weapons[0]?.damage).toBeGreaterThanOrEqual(15);
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
    expect(second.progression.totalXp).toBe(0);
    expect(second.progression.level).toBe(1);
    expect(second.passiveLevels.size).toBe(0);
    expect(second.weapons[0]?.level).toBe(1);
    expect(second.gems.gems.activeCount).toBe(0);
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
