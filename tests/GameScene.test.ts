import { describe, expect, it } from 'vitest';
import { CONTACT_HIT_COOLDOWN } from '../src/data/combat';
import { ENEMY_TYPES } from '../src/data/enemies';
import { PLAYER_BASE } from '../src/data/player';
import { GameScene, type GameSceneDeps } from '../src/scenes/GameScene';
import type { RunReport } from '../src/systems/runReport';
import { WEAPONS, weaponMaxLevel } from '../src/data/weapons';
import { MAX_PASSIVES, MAXED_XP_MULT, REROLLS_PER_RUN } from '../src/data/progression';
import { choiceKey } from '../src/systems/upgrades';
import { PASSIVES } from '../src/data/upgrades';
import { BOSS_TYPE } from '../src/data/waves';
import { DEFAULT_SETTINGS } from '../src/data/settings';
import { Weapon } from '../src/entities/Weapon';
import type { PauseAction } from '../src/ui/PauseOverlay';
import type { OptionsAction } from '../src/ui/OptionsOverlay';
import type { DevAction, DevView } from '../src/ui/DevPanel';

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
    /** Fins de partie signalées (pour le profil) */
    runEnds: 0,
    /** Dernier bilan envoyé au profil */
    recorded: null as RunReport | null,
    endlessShown: false,
    testShown: false,
    /** Clic simulé sur un bouton du menu pause */
    pauseClick: null as PauseAction | null,
    hudVisible: false,
    levelUpShown: null as { level: number; titles: string[] } | null,
    /** Clic simulé sur une carte de level up (lu une fois par la scène) */
    click: null as number | null,
    /** Bouton de relance : compteur affiché et état (null = jamais affiché) */
    rerolls: null as { left: number; enabled: boolean } | null,
    /** Clic simulé sur le bouton de relance */
    rerollClick: false,
    /** Écran Options affiché (depuis la pause) */
    optionsShown: false,
    /** Action simulée sur l'écran Options */
    optionsAction: null as OptionsAction | null,
    /** Réglages changés (= sauvegardes demandées à main.ts) */
    settingsSaves: 0,
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
      setRerolls: (left, enabled) => (ui.rerolls = { left, enabled }),
      takeReroll: () => {
        const c = ui.rerollClick;
        ui.rerollClick = false;
        return c;
      },
    },
    hud: {
      setVisible: (v) => (ui.hudVisible = v),
      setEndless: (v) => (ui.endlessShown = v),
      setTest: (v) => (ui.testShown = v),
      setGold: () => {},
      setTime: () => {},
      setProgress: () => {},
      setHp: () => {},
      setKills: () => {},
      setInventory: () => {},
    },
    debug: { setStat: () => {}, showHitboxes: false },
    settings: { ...DEFAULT_SETTINGS },
    optionsOverlay: {
      show: () => (ui.optionsShown = true),
      hide: () => (ui.optionsShown = false),
      refresh: () => {},
      takeAction: () => {
        const a = ui.optionsAction;
        ui.optionsAction = null;
        return a;
      },
    },
    onSettingsChanged: () => ui.settingsSaves++,
    onRestart: () => ui.restarts++,
    onMenu: () => ui.menus++,
    onRunEnd: (report) => {
      ui.runEnds++;
      ui.recorded = report;
    },
    unlocksFor: () => [],
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
    // Sans régénération : on compare des PV exacts, seul le délai de coup est testé ici.
    scene.player.regen = 0;
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

describe('GameScene — gemme verte du basique', () => {
  it('environ une gemme de basique sur deux est verte et vaut double', () => {
    const { scene } = newScene();
    // Aimant coupé : les gemmes restent au sol (sinon un level up figerait le test).
    scene.player.pickupRadius = 0;
    scene.player.hp = scene.player.maxHp = 1e9; // ne meurt pas pendant le test
    for (let n = 0; n < 40; n++) {
      const e = scene.enemies.acquire();
      e?.spawn(ENEMY_TYPES.basic, 300, 0);
      if (e) e.hp = 1;
      const before = scene.kills;
      for (let i = 0; i < 300 && scene.kills === before; i++) scene.update(DT);
    }
    const gems = scene.gems.gems.items.filter((g) => g.active);
    const green = gems.filter((g) => g.bonus);
    const blue = gems.filter((g) => !g.bonus);
    expect(green.length).toBeGreaterThan(8);
    expect(blue.length).toBeGreaterThan(8);
    for (const g of green) expect(g.value).toBe(2);
    for (const g of blue) expect(g.value).toBe(1);
  });

  it('les autres ennemis ne lâchent jamais de gemme verte', () => {
    const { scene } = newScene();
    scene.player.pickupRadius = 0;
    scene.player.hp = scene.player.maxHp = 1e9; // ne meurt pas pendant le test
    for (let n = 0; n < 20; n++) {
      scene.enemies.acquire()?.spawn(ENEMY_TYPES.fast, 300, 0);
      const before = scene.kills;
      for (let i = 0; i < 300 && scene.kills === before; i++) scene.update(DT);
    }
    expect(scene.gems.gems.items.some((g) => g.active && g.bonus)).toBe(false);
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

  it('réglage « Nombres de dégâts » désactivé : flash, mais aucun nombre', () => {
    const { scene, deps } = newScene();
    deps.settings = { ...DEFAULT_SETTINGS, damageNumbers: false };
    const tank = scene.enemies.acquire();
    tank?.spawn(ENEMY_TYPES.tank, 200, 0);
    let flashed = false;
    for (let i = 0; i < 60 && !flashed; i++) {
      scene.update(DT);
      flashed = (tank?.flashUntil ?? 0) > 0;
    }
    expect(flashed).toBe(true);
    expect(scene.damageNumbers.numbers.activeCount).toBe(0);
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

  it('R : relance les cartes (d’autres cartes), une relance en moins', () => {
    const { scene, ui, press } = newScene({ armed: false });
    giveXp(scene, 15);
    expect(ui.rerolls).toEqual({ left: REROLLS_PER_RUN, enabled: true });
    const before = scene.currentChoices.map(choiceKey);
    press('KeyR', scene);
    expect(scene.isChoosingUpgrade).toBe(true);
    expect(scene.rerollsLeft).toBe(REROLLS_PER_RUN - 1);
    expect(ui.rerolls?.left).toBe(REROLLS_PER_RUN - 1);
    // Au niveau 2 il reste largement assez d'options : aucune carte ne revient.
    const after = scene.currentChoices.map(choiceKey);
    expect(after).toHaveLength(3);
    for (const key of after) expect(before).not.toContain(key);
    expect(ui.restarts).toBe(0); // R ne relance pas la partie ici
  });

  it('le bouton de relance marche aussi ; plus de relance : rien ne change', () => {
    const { scene, ui } = newScene({ armed: false });
    giveXp(scene, 15);
    for (let i = 0; i < REROLLS_PER_RUN; i++) {
      ui.rerollClick = true;
      scene.update(DT);
    }
    expect(scene.rerollsLeft).toBe(0);
    expect(ui.rerolls?.enabled).toBe(false);
    const titles = scene.currentChoices.map((c) => c.title);
    ui.rerollClick = true;
    scene.update(DT);
    expect(scene.currentChoices.map((c) => c.title)).toEqual(titles);
    expect(scene.rerollsLeft).toBe(0);
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

  it('mutation = niveau 6 : ses 2 variantes sont des cartes du tirage normal', () => {
    const { scene, press } = newScene({ armed: false });
    const aura = new Weapon(WEAPONS.burningAura);
    aura.level = weaponMaxLevel(WEAPONS.burningAura);
    scene.weapons.push(aura);
    // Les 3 autres armes déjà mutées (4 emplacements pleins) et les passifs au max :
    // il ne reste que les 2 mutations de l'aura dans le tirage.
    for (const def of [WEAPONS.arcaneBolt, WEAPONS.runicOrbs, WEAPONS.sword]) {
      const w = new Weapon(def);
      w.level = weaponMaxLevel(def) + 1;
      w.mutation = def.mutations[0];
      scene.weapons.push(w);
    }
    for (const p of PASSIVES.slice(0, MAX_PASSIVES)) scene.passiveLevels.set(p.id, p.maxLevel);
    giveXp(scene, scene.progression.xpForNext);
    const titles = scene.currentChoices.map((c) => c.title);
    const toxic = titles.indexOf('★ Aura toxique');
    expect(toxic).toBeGreaterThanOrEqual(0);
    expect(scene.currentChoices[toxic]?.levelText).toBe('Niv 6 · Mutation');

    press(`Digit${toxic + 1}`, scene);
    expect(aura.mutation?.name).toBe('Aura toxique');
    expect(aura.level).toBe(6);
    expect(scene.isChoosingUpgrade).toBe(false);

    // Le level up d'après redevient normal (l'arme ne peut muter qu'une fois).
    giveXp(scene, scene.progression.xpForNext);
    expect(scene.currentChoices.some((c) => c.kind === 'mutation')).toBe(false);
  });

  it('tout au maximum : les niveaux suivants demandent ×4 d’XP', () => {
    const { scene, press } = newScene({ armed: false });
    // Tout au max sauf un passif à 4/5, toutes les armes mutées.
    for (const def of [WEAPONS.arcaneBolt, WEAPONS.burningAura, WEAPONS.runicOrbs, WEAPONS.sword]) {
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

  it('boss encore en vie au timer : prolongations, puis victoire à sa mort', () => {
    const { scene, ui } = newScene({ runDuration: 1, armed: false });
    const boss = scene.enemies.acquire();
    if (!boss) throw new Error();
    boss.spawn(BOSS_TYPE, scene.player.x + 600, scene.player.y);
    for (let i = 0; i < 90; i++) scene.update(DT); // 1,5 s : timer dépassé
    expect(scene.isOver).toBe(false);
    expect(scene.isOvertime).toBe(true);
    expect(scene.runTime).toBeGreaterThan(1); // le timer continue

    scene.enemies.release(boss); // le boss meurt
    scene.update(DT);
    expect(ui.end?.victory).toBe(true);
    expect(ui.end?.time).toBeGreaterThan(1.5); // temps réel, prolongations comprises
  });

  it('défaite : envoyée au profil tout de suite, une seule fois', () => {
    const { scene, ui } = newScene();
    scene.player.hp = 1;
    enemyOnPlayer(scene);
    for (let i = 0; i < 60; i++) scene.update(DT);
    expect(ui.runEnds).toBe(1);
    scene.exit();
    expect(ui.runEnds).toBe(1);
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

  it('R, M et O ne font rien hors pause', () => {
    const { scene, ui, press } = newScene();
    press('KeyR', scene);
    press('KeyM', scene);
    press('KeyO', scene);
    expect(ui.restarts).toBe(0);
    expect(ui.menus).toBe(0);
    expect(scene.isOptionsOpen).toBe(false);
    expect(ui.optionsShown).toBe(false);
  });

  it('Options (bouton ou O) : l’écran Options remplace le menu pause', () => {
    const { scene, ui, press } = pausedScene();
    ui.pauseClick = 'options';
    scene.update(DT);
    expect(scene.isOptionsOpen).toBe(true);
    expect(ui.optionsShown).toBe(true);
    expect(ui.paused).toBe(false); // menu pause caché pendant les options
    press('Escape', scene);
    press('KeyO', scene);
    expect(ui.optionsShown).toBe(true);
  });

  it('un réglage changé en partie est appliqué et sauvegardé', () => {
    const { scene, ui, deps, press } = pausedScene();
    press('KeyO', scene);
    const before = deps.settings.damageNumbers;
    ui.optionsAction = { kind: 'toggle', key: 'damageNumbers' };
    scene.update(DT);
    expect(deps.settings.damageNumbers).toBe(!before);
    ui.optionsAction = { kind: 'volume', key: 'volumeMusic', value: 0.3 };
    scene.update(DT);
    expect(deps.settings.volumeMusic).toBe(0.3);
    expect(ui.settingsSaves).toBe(2);
  });

  it('Échap dans les options ramène à la pause (partie toujours figée), puis reprend', () => {
    const { scene, ui, press } = pausedScene();
    press('KeyO', scene);
    const time = scene.runTime;
    press('Escape', scene);
    expect(scene.isOptionsOpen).toBe(false);
    expect(ui.optionsShown).toBe(false);
    expect(ui.paused).toBe(true);
    for (let i = 0; i < 30; i++) scene.update(DT);
    expect(scene.runTime).toBe(time);
    // Le bouton Retour fait pareil.
    press('KeyO', scene);
    ui.optionsAction = { kind: 'back' };
    scene.update(DT);
    expect(ui.paused).toBe(true);
    press('Escape', scene);
    expect(ui.paused).toBe(false);
  });
});

describe('GameScene — sortie du plein écran', () => {
  it('met la partie en pause (Échap ne parvient pas au jeu dans ce cas)', () => {
    const { scene, ui } = newScene();
    scene.onFullscreenExit();
    expect(ui.paused).toBe(true);
  });

  it('ne réaffiche pas le menu pause par-dessus les options', () => {
    const { scene, ui, press } = newScene();
    press('Escape', scene);
    press('KeyO', scene);
    scene.onFullscreenExit();
    expect(ui.optionsShown).toBe(true);
    expect(ui.paused).toBe(false); // le menu pause ne revient pas par-dessus les options
  });
});

describe('GameScene — onglet caché', () => {
  it('met la partie en pause', () => {
    const { scene, ui } = newScene();
    scene.onHidden();
    expect(scene.isPaused).toBe(true);
    expect(ui.paused).toBe(true);
  });

  it('réglage « Pause quand l’onglet est caché » désactivé : pas de pause', () => {
    const { scene, ui, deps } = newScene();
    deps.settings = { ...DEFAULT_SETTINGS, pauseOnHidden: false };
    scene.onHidden();
    expect(scene.isPaused).toBe(false);
    expect(ui.paused).toBe(false);
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

describe('GameScene — mode sans fin', () => {
  /** Partie gagnée (timer court, pas de boss) : on est sur l'écran de victoire. */
  function won() {
    const ctx = newScene({ runDuration: 1, armed: false });
    for (let i = 0; i < 70; i++) ctx.scene.update(DT);
    expect(ctx.ui.end?.victory).toBe(true);
    return ctx;
  }

  it('victoire : pas encore envoyée au profil (on peut continuer), puis une fois en quittant', () => {
    const { scene, ui } = won();
    expect(ui.runEnds).toBe(0);
    scene.exit(); // R ou M : main.ts change de scène
    expect(ui.runEnds).toBe(1);
    expect(ui.recorded?.endless).toBe(false);
  });

  it('C sur l’écran de victoire : la partie reprend, le timer continue, plus de victoire', () => {
    const { scene, ui, press } = won();
    press('KeyC', scene);
    expect(scene.isEndless).toBe(true);
    expect(scene.isOver).toBe(false);
    expect(ui.end).toBeNull();
    expect(ui.endlessShown).toBe(true);
    const time = scene.runTime;
    for (let i = 0; i < 120; i++) scene.update(DT);
    expect(scene.runTime).toBeGreaterThan(time);
    expect(scene.isOver).toBe(false); // le timer dépassé ne redonne pas la victoire
  });

  it('mort en sans fin : victoire + sans fin, temps total, envoyée une seule fois', () => {
    const { scene, ui, press } = won();
    press('KeyC', scene);
    for (let i = 0; i < 60; i++) scene.update(DT);
    scene.player.hp = 1;
    enemyOnPlayer(scene);
    scene.update(DT);
    expect(ui.end?.victory).toBe(true);
    expect(ui.end?.endless).toBe(true);
    expect(ui.end?.time).toBeGreaterThan(1.5);
    expect(ui.runEnds).toBe(1);
    press('KeyC', scene); // plus de continuer après une mort
    expect(scene.isOver).toBe(true);
    scene.exit();
    expect(ui.runEnds).toBe(1);
  });

  it('sans fin quitté par le menu pause : compte quand même comme une victoire', () => {
    const { scene, ui, press } = won();
    press('KeyC', scene);
    for (let i = 0; i < 30; i++) scene.update(DT);
    scene.exit();
    expect(ui.runEnds).toBe(1);
    expect(ui.recorded?.victory).toBe(true);
    expect(ui.recorded?.endless).toBe(true);
  });

  it('C ne fait rien sur l’écran de défaite', () => {
    const { scene, press } = newScene();
    scene.player.hp = 1;
    enemyOnPlayer(scene);
    scene.update(DT);
    press('KeyC', scene);
    expect(scene.isEndless).toBe(false);
    expect(scene.isOver).toBe(true);
  });
});

describe('GameScene — persos et défis', () => {
  it('commence avec l’arme du perso choisi', () => {
    const ctx = makeDeps();
    const scene = new GameScene(ctx.deps, 1, { startWeapon: WEAPONS.runicOrbs });
    expect(scene.weapons.map((w) => w.def.id)).toEqual(['runicOrbs']);
  });

  /** Partie avec un boss n°  au contact des orbes, tué net, puis mort du joueur. */
  function killBoss(orbLevel: number, bossIndex: number) {
    const { scene, ui } = newScene({ armed: false });
    const orbs = new Weapon(WEAPONS.runicOrbs);
    orbs.level = orbLevel;
    scene.weapons.push(orbs);
    const boss = scene.enemies.acquire();
    if (!boss) throw new Error();
    boss.spawn(BOSS_TYPE, scene.player.x + 400, scene.player.y);
    boss.bossIndex = bossIndex;
    boss.hp = 0.01;
    // Le premier coup d'orbe qui le touche le tue : on le place sur l'orbite.
    boss.teleport(scene.player.x + orbs.orbitDistance, scene.player.y);
    for (let i = 0; i < 120 && boss.active; i++) scene.update(DT);
    expect(boss.active).toBe(false);
    scene.player.hp = 1;
    enemyOnPlayer(scene);
    for (let i = 0; i < 60 && !scene.isOver; i++) scene.update(DT);
    return ui.end?.challenges ?? [];
  }

  it('Runiste : boss de 9:00 tué avec les Orbes niveau 5 → défi réussi', () => {
    expect(killBoss(5, 1)).toEqual(['runistBoss']);
  });

  it('pas réussi avec les Orbes niveau 4, ni sur le boss de 5:00', () => {
    expect(killBoss(4, 1)).toEqual([]);
    expect(killBoss(5, 0)).toEqual([]);
  });
});

describe('GameScene — menu de test (F2)', () => {
  /** Partie avec un faux panneau : on lui « clique » des actions. */
  function withPanel() {
    const ctx = makeDeps();
    const panel = {
      visible: false,
      queue: [] as DevAction[],
      view: null as DevView | null,
      setVisible(v: boolean) {
        this.visible = v;
      },
      takeActions() {
        return this.queue.splice(0, this.queue.length);
      },
      refresh(v: DevView) {
        this.view = v;
      },
    };
    ctx.deps.devPanel = panel;
    const scene = new GameScene(ctx.deps, 1234);
    scene.enter();
    /** Clique des actions puis laisse passer une update. */
    const click = (...actions: DevAction[]) => {
      panel.queue.push(...actions);
      scene.update(DT);
    };
    return { scene, panel, click, ...ctx };
  }

  it('F2 ouvre le menu et fige la partie ; F2 le referme', () => {
    const { scene, panel, press } = withPanel();
    press('F2', scene);
    expect(panel.visible).toBe(true);
    const time = scene.runTime;
    for (let i = 0; i < 30; i++) scene.update(DT);
    expect(scene.runTime).toBe(time);
    press('F2', scene);
    expect(panel.visible).toBe(false);
    scene.update(DT);
    expect(scene.runTime).toBeGreaterThan(time);
  });

  it('armes : ajouter, régler le niveau, muter ; passifs : monter et redescendre', () => {
    const { scene, panel, press, click } = withPanel();
    press('F2', scene);
    click({ kind: 'weaponToggle', id: 'sword' }, { kind: 'weaponLevel', id: 'sword', delta: 3 });
    const sword = scene.weapons.find((w) => w.def.id === 'sword');
    expect(sword?.level).toBe(4);
    click({ kind: 'mutation', id: 'sword', index: 0 });
    expect(sword?.mutation?.name).toBe('Tourbillon');
    expect(sword?.level).toBe(6);
    expect(panel.view?.weapons.find((w) => w.id === 'sword')?.mutation).toBe(0);

    click(
      { kind: 'passive', id: 'vitality', delta: 1 },
      { kind: 'passive', id: 'vitality', delta: 1 },
    );
    expect(scene.player.maxHp).toBe(PLAYER_BASE.maxHp + 30);
    expect(scene.player.regen).toBeCloseTo(PLAYER_BASE.regen + 0.6);
    click({ kind: 'passive', id: 'vitality', delta: -2 });
    expect(scene.player.maxHp).toBe(PLAYER_BASE.maxHp);
    expect(scene.passiveLevels.has('vitality')).toBe(false);
  });

  it('aller à 9:00 fait venir le boss de 9:00 seulement (pas celui de 5:00)', () => {
    const { scene, press, click } = withPanel();
    press('F2', scene);
    click({ kind: 'time', seconds: 540 });
    press('F2', scene);
    for (let i = 0; i < 5; i++) scene.update(DT);
    const bosses = scene.enemies.items.filter((e) => e.active && e.type === BOSS_TYPE);
    expect(bosses).toHaveLength(1);
    expect(bosses[0]?.bossIndex).toBe(1);
  });

  it('partie de test : badge TEST, invincible possible, et rien n’est enregistré au profil', () => {
    const { scene, ui, press, click } = withPanel();
    press('F2', scene);
    click({ kind: 'god' });
    expect(ui.testShown).toBe(true);
    press('F2', scene);
    enemyOnPlayer(scene);
    for (let i = 0; i < 60; i++) scene.update(DT);
    expect(scene.player.hp).toBe(scene.player.maxHp); // invincible
    expect(scene.isTestRun).toBe(true);

    scene.applyDevAction({ kind: 'god' }); // plus invincible
    scene.player.hp = 1;
    for (let i = 0; i < 60 && !scene.isOver; i++) scene.update(DT);
    expect(scene.isOver).toBe(true);
    expect(ui.runEnds).toBe(0);
    scene.exit();
    expect(ui.runEnds).toBe(0);
  });

  it('sans panneau (build de prod, tests) : F2 ne fait rien', () => {
    const { scene, press } = newScene();
    const time = scene.runTime;
    press('F2', scene);
    expect(scene.runTime).toBeGreaterThan(time);
    expect(scene.isTestRun).toBe(false);
  });
});

describe('GameScene — mobilier et or', () => {
  it('un meuble cassé lâche or ou nourriture, sans compter de kill', () => {
    const { scene } = newScene();
    const crate = scene.enemies.acquire();
    if (!crate) throw new Error();
    crate.spawn(ENEMY_TYPES.crate, scene.player.x + 60, scene.player.y);
    scene.applyDevAction({ kind: 'killAll' });
    expect(crate.active).toBe(false);
    expect(scene.kills).toBe(0);
    expect(scene.pickups.activeCount).toBe(1);
  });

  it('boss tué : +25 or ; l’or de la partie est dans le bilan', () => {
    const { scene, ui } = newScene({ armed: false });
    const boss = scene.enemies.acquire();
    if (!boss) throw new Error();
    boss.spawn(BOSS_TYPE, scene.player.x + 300, scene.player.y);
    boss.hp = 0.01;
    const orbs = new Weapon(WEAPONS.runicOrbs);
    scene.weapons.push(orbs);
    boss.teleport(scene.player.x + orbs.orbitDistance, scene.player.y);
    for (let i = 0; i < 120 && boss.active; i++) scene.update(DT);
    expect(scene.gold).toBe(25);
    scene.player.hp = 1;
    enemyOnPlayer(scene);
    for (let i = 0; i < 60 && !scene.isOver; i++) scene.update(DT);
    expect(ui.end?.gold).toBe(25);
  });
});

describe('GameScene — casser le mobilier en marchant dessus', () => {
  it('toucher un meuble le casse (même invincible) et lâche son butin', () => {
    const { scene } = newScene({ armed: false });
    scene.applyDevAction({ kind: 'god' });
    const crate = scene.enemies.acquire();
    if (!crate) throw new Error();
    crate.spawn(ENEMY_TYPES.crate, scene.player.x + 10, scene.player.y);
    scene.update(DT);
    expect(crate.active).toBe(false);
    expect(scene.pickups.activeCount).toBe(1);
    expect(scene.player.hp).toBe(scene.player.maxHp);
  });
});

describe('GameScene — bonus de boutique', () => {
  it('la partie commence avec les bonus achetés, PV pleins', () => {
    const ctx = makeDeps();
    const scene = new GameScene(ctx.deps, 1, { shopRanks: { startVitality: 2, startPower: 1 } });
    expect(scene.player.maxHp).toBe(PLAYER_BASE.maxHp + 10);
    expect(scene.player.hp).toBe(scene.player.maxHp);
    expect(scene.player.damageMult).toBeCloseTo(1.03);
  });

  it('menu de test : baisser un passif garde les bonus de boutique', () => {
    const ctx = makeDeps();
    const scene = new GameScene(ctx.deps, 1, { shopRanks: { startVitality: 2 } });
    scene.applyDevAction({ kind: 'passive', id: 'vitality', delta: 1 });
    scene.applyDevAction({ kind: 'passive', id: 'vitality', delta: -1 });
    expect(scene.player.maxHp).toBe(PLAYER_BASE.maxHp + 10);
  });
});

describe('GameScene — mini-boss', () => {
  it('un mini-boss tué rapporte +10 or et compte comme un kill', () => {
    const { scene } = newScene({ armed: false });
    const elite = scene.enemies.acquire();
    if (!elite) throw new Error();
    elite.spawn(ENEMY_TYPES.fastElite, scene.player.x + 300, scene.player.y);
    elite.hp = 0.01;
    const orbs = new Weapon(WEAPONS.runicOrbs);
    scene.weapons.push(orbs);
    elite.teleport(scene.player.x + orbs.orbitDistance, scene.player.y);
    for (let i = 0; i < 120 && elite.active; i++) scene.update(DT);
    expect(elite.active).toBe(false);
    expect(scene.gold).toBe(10);
    expect(scene.kills).toBe(1);
    // Nourriture garantie sur chaque élite tué
    expect(scene.pickups.activeCount).toBe(1);
  });
});
