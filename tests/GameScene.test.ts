import { describe, expect, it } from 'vitest';
import { CONTACT_HIT_COOLDOWN } from '../src/data/combat';
import { ENEMY_TYPES } from '../src/data/enemies';
import { PLAYER_BASE } from '../src/data/player';
import { GameScene, type GameSceneDeps } from '../src/scenes/GameScene';
import type { RunReport } from '../src/systems/runReport';
import { WEAPONS, weaponMaxLevel } from '../src/data/weapons';
import { MAX_PASSIVES, MAXED_XP_MULT } from '../src/data/progression';
import { PASSIVES } from '../src/data/upgrades';
import { Weapon } from '../src/entities/Weapon';
import type { PauseAction } from '../src/ui/PauseOverlay';

const DT = 1 / 60;

/** Faux objets à la place du navigateur : on peut "appuyer" sur des touches et lire l'UI. */
function makeDeps() {
  const pressed = new Set<string>();
  const ui = {
    paused: false,
    /** Bilan affiché sur l'écran de fin (null = masqué) */
    end: null as RunReport | null,
    restarts: 0,
    menus: 0,
    /** Clic simulé sur un bouton du menu pause */
    pauseClick: null as PauseAction | null,
    hudVisible: false,
    levelUpShown: null as { level: number; titles: string[] } | null,
    /** Clic simulé sur une carte de level up (lu une fois par la scène) */
    click: null as number | null,
  };
  const deps: GameSceneDeps = {
    input: {
      isDown: () => false,
      wasPressed: (codes) => codes.some((c) => pressed.has(c)),
    },
    pauseOverlay: {
      setVisible: (v) => (ui.paused = v),
      takeAction: () => {
        const a = ui.pauseClick;
        ui.pauseClick = null;
        return a;
      },
    },
    endOverlay: {
      show: (report) => (ui.end = report),
      hide: () => (ui.end = null),
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
    hud: {
      setVisible: (v) => (ui.hudVisible = v),
      setTime: () => {},
      setProgress: () => {},
      setHp: () => {},
      setKills: () => {},
      setInventory: () => {},
    },
    debug: { setStat: () => {}, showHitboxes: false },
    onRestart: () => ui.restarts++,
    onMenu: () => ui.menus++,
  };
  /** Simule un appui unique (vu par une seule update, comme Input.endUpdate). */
  const press = (code: string, scene: GameScene) => {
    pressed.add(code);
    scene.update(DT);
    pressed.clear();
  };
  return { deps, ui, press };
}

/**
 * `armed: false` retire les armes : utile pour tester le contact sans que l'arme tue l'ennemi.
 * `runDuration` raccourcit la partie (s) pour tester la victoire sans simuler 10 minutes.
 */
function newScene({ armed = true, runDuration }: { armed?: boolean; runDuration?: number } = {}) {
  const ctx = makeDeps();
  const scene = new GameScene(ctx.deps, 1234, runDuration ? { runDuration } : {});
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
    expect(scene.isOver).toBe(true);
    expect(ui.end?.victory).toBe(false);
    expect(ui.end?.time).toBeGreaterThan(0);

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

  it('M après la mort ramène au menu (M AZERTY = Semicolon) ; M en partie ne fait rien', () => {
    const { scene, ui, press } = newScene();
    expect(ui.hudVisible).toBe(true);
    press('KeyM', scene);
    expect(ui.menus).toBe(0);

    scene.player.hp = 1;
    enemyOnPlayer(scene);
    scene.update(DT);
    press('Semicolon', scene);
    expect(ui.menus).toBe(1);
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

  it('un ennemi renforcé par la vague rapporte plus d’XP (× son multiplicateur)', () => {
    const { scene } = newScene();
    scene.enemies.acquire()?.spawn(ENEMY_TYPES.fast, 200, 0, 2);
    for (let i = 0; i < 90 && scene.kills === 0; i++) scene.update(DT);
    const gem = scene.gems.gems.items.find((g) => g.active);
    expect(gem?.value).toBe(ENEMY_TYPES.fast.xp * 2);
  });

  it('l’écran de mort affiche les kills', () => {
    const { scene, ui } = newScene();
    scene.enemies.acquire()?.spawn(ENEMY_TYPES.basic, 200, 0);
    for (let i = 0; i < 60; i++) scene.update(DT);
    scene.player.hp = 1;
    enemyOnPlayer(scene);
    scene.update(DT);
    expect(scene.isOver).toBe(true);
    expect(ui.end?.kills).toBe(scene.kills);
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

  it('mutation : arme au max → le level up suivant propose ses 2 variantes', () => {
    const { scene, ui, press } = newScene({ armed: false });
    const aura = new Weapon(WEAPONS.burningAura);
    aura.level = weaponMaxLevel(WEAPONS.burningAura);
    scene.weapons.push(aura);
    giveXp(scene, scene.progression.xpForNext);
    expect(ui.levelUpShown?.titles).toEqual(['★ Brasier', '★ Aura toxique']);

    press('Digit2', scene);
    expect(aura.mutation?.name).toBe('Aura toxique');
    expect(scene.isChoosingUpgrade).toBe(false);

    // Le level up d'après redevient normal (l'arme ne peut muter qu'une fois).
    giveXp(scene, scene.progression.xpForNext);
    expect(scene.currentChoices.some((c) => c.kind === 'mutation')).toBe(false);
  });

  it('tout au maximum : les niveaux suivants demandent ×4 d’XP', () => {
    const { scene, press } = newScene({ armed: false });
    // Tout au max sauf un passif à 4/5, toutes les armes mutées.
    for (const def of [WEAPONS.arcaneBolt, WEAPONS.burningAura, WEAPONS.runicOrbs]) {
      const w = new Weapon(def);
      w.level = weaponMaxLevel(def);
      w.mutation = def.mutations[0];
      scene.weapons.push(w);
    }
    // 4 emplacements de passifs pleins : 3 au max + Impact à 4/5.
    for (const p of PASSIVES.slice(0, MAX_PASSIVES - 1)) scene.passiveLevels.set(p.id, p.maxLevel);
    scene.passiveLevels.set('impact', 4);
    expect(scene.progression.xpMult).toBe(1);

    giveXp(scene, scene.progression.xpForNext);
    // Seul Impact reste améliorable : les autres passifs n'ont plus d'emplacement.
    expect(scene.currentChoices.map((c) => c.title)).toEqual(['Impact']);
    press('Digit1', scene);
    expect(scene.progression.xpMult).toBe(MAXED_XP_MULT);
    const maxedAt = scene.runTime;

    // Le bilan de fin note quand le build a été complet (pour l'équilibrage).
    scene.player.hp = 1;
    enemyOnPlayer(scene);
    scene.update(DT);
    expect(scene.result?.maxedAt).toBe(maxedAt);
    expect(scene.runTime).toBeGreaterThan(maxedAt);
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

describe('GameScene — victoire et bilan', () => {
  it('survivre jusqu’au timer : victoire, tout se fige, bilan affiché', () => {
    const { scene, ui } = newScene({ runDuration: 2 });
    for (let i = 0; i < 2 * 60 + 5; i++) scene.update(DT);
    expect(scene.isOver).toBe(true);
    expect(ui.end?.victory).toBe(true);
    expect(ui.end?.time).toBe(2); // le temps affiché ne dépasse pas la durée de la partie
    expect(ui.end?.level).toBe(scene.progression.level);

    const enemy = scene.enemies.items.find((e) => e.active);
    const x = enemy?.x;
    for (let i = 0; i < 60; i++) scene.update(DT);
    expect(enemy?.x).toBe(x); // les ennemis restent figés
  });

  it('R après la victoire relance une partie', () => {
    const { scene, ui, press } = newScene({ runDuration: 1 });
    for (let i = 0; i < 65; i++) scene.update(DT);
    press('KeyR', scene);
    expect(ui.restarts).toBe(1);
  });

  it('le bilan contient le damage meter, trié par dégâts', () => {
    const { scene, ui } = newScene({ runDuration: 3 });
    scene.enemies.acquire()?.spawn(ENEMY_TYPES.fast, 200, 0);
    for (let i = 0; i < 3 * 60 + 5; i++) scene.update(DT);
    const weapons = ui.end?.weapons ?? [];
    expect(weapons[0]?.name).toBe('Trait arcanique');
    expect(weapons[0]?.damage).toBeGreaterThan(0);
    expect(weapons[0]?.share).toBe(1);
  });
});

describe('GameScene — rejouer sans fuite d’état', () => {
  it('une nouvelle scène repart de zéro, même après une partie chargée', () => {
    const first = newScene();
    for (let i = 0; i < 600; i++) first.scene.update(DT); // 10 s de jeu
    first.scene.player.hp = 1;
    enemyOnPlayer(first.scene);
    first.scene.update(DT);
    expect(first.scene.isOver).toBe(true);

    // "Rejouer" = nouvelle scène, mêmes objets d'UI partagés que la précédente.
    first.scene.exit();
    const second = new GameScene(first.deps, 99);
    second.enter();
    expect(first.ui.end).toBeNull(); // écran de fin masqué
    expect(first.ui.paused).toBe(false);
    expect(second.isOver).toBe(false);
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

describe('GameScene — menu pause', () => {
  /** Partie mise en pause avec Échap. */
  function pausedScene() {
    const ctx = newScene();
    ctx.press('Escape', ctx.scene);
    expect(ctx.ui.paused).toBe(true);
    return ctx;
  }

  it('Échap ou P met en pause puis reprend ; le temps ne bouge pas pendant la pause', () => {
    const { scene, ui, press } = pausedScene();
    const time = scene.runTime;
    for (let i = 0; i < 60; i++) scene.update(DT);
    expect(scene.runTime).toBe(time);
    press('KeyP', scene);
    expect(ui.paused).toBe(false);
    scene.update(DT);
    expect(scene.runTime).toBeGreaterThan(time);
  });

  it('le bouton Reprendre enlève la pause', () => {
    const { scene, ui } = pausedScene();
    ui.pauseClick = 'resume';
    scene.update(DT);
    expect(ui.paused).toBe(false);
  });

  it('Rejouer (bouton ou R) demande une partie neuve', () => {
    const { scene, ui, press } = pausedScene();
    ui.pauseClick = 'restart';
    scene.update(DT);
    expect(ui.restarts).toBe(1);
    press('KeyR', scene);
    expect(ui.restarts).toBe(2);
    expect(ui.menus).toBe(0);
  });

  it('Menu principal (bouton ou M) ramène au menu', () => {
    const { scene, ui, press } = pausedScene();
    ui.pauseClick = 'menu';
    scene.update(DT);
    expect(ui.menus).toBe(1);
    press('KeyM', scene);
    expect(ui.menus).toBe(2);
    expect(ui.restarts).toBe(0);
  });

  it('R et M ne font rien hors pause', () => {
    const { scene, ui, press } = newScene();
    press('KeyR', scene);
    press('KeyM', scene);
    expect(ui.restarts).toBe(0);
    expect(ui.menus).toBe(0);
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
