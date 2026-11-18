import type { Rng } from '../core/math';
import { PLAYER_BASE } from '../data/player';
import { MAX_PASSIVES, MAX_WEAPONS } from '../data/progression';
import { HEAL_UPGRADE, PASSIVES, type PassiveDef } from '../data/upgrades';
import { WEAPON_LIST, weaponMaxLevel, type MutationDef, type WeaponDef } from '../data/weapons';
import type { Player } from '../entities/Player';
import { Weapon } from '../entities/Weapon';

/** Un choix proposé au level up. Les champs d'affichage sont communs à tous les types. */
export type UpgradeChoice = {
  readonly title: string;
  readonly description: string;
  /** Ex. "Niv 3", "Nouveau" */
  readonly levelText: string;
} & (
  | { readonly kind: 'weaponLevel'; readonly weapon: Weapon }
  | { readonly kind: 'newWeapon'; readonly def: WeaponDef }
  | { readonly kind: 'mutation'; readonly weapon: Weapon; readonly mutation: MutationDef }
  | { readonly kind: 'passive'; readonly passive: PassiveDef }
  | { readonly kind: 'heal' }
);

/** Icône d'un choix (id de l'arme, de la mutation ou du passif) ; aucune pour le soin. */
export function choiceIconId(choice: UpgradeChoice): string | undefined {
  switch (choice.kind) {
    case 'weaponLevel':
      return choice.weapon.def.id;
    case 'newWeapon':
      return choice.def.id;
    case 'mutation':
      return choice.mutation.id;
    case 'passive':
      return choice.passive.id;
    case 'heal':
      return undefined;
  }
}

/** Ce dont le système d'upgrades a besoin (et qu'il modifie). */
export interface Build {
  readonly player: Player;
  /** Modifiable : une nouvelle arme s'y ajoute */
  readonly weapons: Weapon[];
  /** Niveau de chaque passif possédé (absent = 0) */
  readonly passiveLevels: Map<string, number>;
}

/**
 * Toutes les améliorations possibles en ce moment (rien de ce qui est déjà au maximum).
 * Appelé seulement au level up : créer des objets ici n'est pas un problème de perf.
 */
export function availableUpgrades(build: Build): UpgradeChoice[] {
  const options: UpgradeChoice[] = [];
  for (const weapon of build.weapons) {
    // Arme au niveau 5 : son niveau 6, c'est la mutation. Ses 2 variantes entrent dans le tirage
    // comme n'importe quelle carte (plus d'écran de mutation forcé).
    if (weapon.canMutate) {
      options.push(...mutationChoices(weapon));
      continue;
    }
    const bonus = weapon.def.levels[weapon.level - 1]; // bonus du niveau suivant
    if (!bonus || weapon.level >= weaponMaxLevel(weapon.def)) continue;
    options.push({
      kind: 'weaponLevel',
      weapon,
      title: weapon.def.name,
      description: bonus.description,
      levelText: `Niv ${weapon.level + 1}`,
    });
  }
  if (build.weapons.length < MAX_WEAPONS) {
    for (const def of WEAPON_LIST) {
      if (build.weapons.some((w) => w.def === def)) continue; // déjà possédée
      options.push({
        kind: 'newWeapon',
        def,
        title: def.name,
        description: def.description,
        levelText: 'Nouvelle arme',
      });
    }
  }
  // Emplacements de passifs pleins : plus de nouveau passif, seulement les niveaux des possédés.
  const passiveSlotsFull = build.passiveLevels.size >= MAX_PASSIVES;
  for (const passive of PASSIVES) {
    const level = build.passiveLevels.get(passive.id) ?? 0;
    if (level >= passive.maxLevel) continue;
    if (level === 0 && passiveSlotsFull) continue;
    options.push({
      kind: 'passive',
      passive,
      title: passive.name,
      description: passive.description,
      levelText: level === 0 ? 'Nouveau' : `Niv ${level + 1}`,
    });
  }
  return options;
}

/**
 * Tire `count` choix différents parmi les options (mélange de Fisher-Yates partiel, seedé).
 * S'il n'y a plus rien à améliorer, propose le soin pour que le level up ne soit jamais vide.
 * `guaranteeNewWeapon` : si aucune nouvelle arme n'est sortie alors qu'il en reste, la dernière
 * carte est remplacée par une nouvelle arme tirée au hasard.
 */
export function rollUpgradeChoices(
  options: readonly UpgradeChoice[],
  rng: Rng,
  count: number,
  guaranteeNewWeapon = false,
): UpgradeChoice[] {
  const picks = shufflePick(options, rng, count);
  if (guaranteeNewWeapon && !picks.some((c) => c.kind === 'newWeapon')) {
    const newWeapons = options.filter((c) => c.kind === 'newWeapon');
    const forced = newWeapons[rng.int(0, newWeapons.length - 1)];
    if (forced) {
      if (picks.length < count) picks.push(forced);
      else picks[picks.length - 1] = forced;
    }
  }
  return picks;
}

function shufflePick(options: readonly UpgradeChoice[], rng: Rng, count: number): UpgradeChoice[] {
  if (options.length === 0) {
    return [
      {
        kind: 'heal',
        title: HEAL_UPGRADE.name,
        description: HEAL_UPGRADE.description,
        levelText: '',
      },
    ];
  }
  const pool = options.slice();
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    // On échange l'élément i avec un élément tiré au hasard dans [i, fin] : sans doublon.
    const j = rng.int(i, pool.length - 1);
    const tmp = pool[i];
    const picked = pool[j];
    if (tmp === undefined || picked === undefined) continue;
    pool[i] = picked;
    pool[j] = tmp;
  }
  return pool.slice(0, n);
}

/** Les 2 variantes proposées pour une arme prête à muter. */
export function mutationChoices(weapon: Weapon): UpgradeChoice[] {
  return (weapon.def.mutations ?? []).map((mutation) => ({
    kind: 'mutation' as const,
    weapon,
    mutation,
    title: `★ ${mutation.name}`,
    description: mutation.description,
    levelText: `Niv ${weapon.level + 1} · Mutation`,
  }));
}

/** Applique le choix du joueur. Les armes doivent ensuite recalculer leurs stats (voir GameScene). */
export function applyUpgrade(choice: UpgradeChoice, build: Build): void {
  switch (choice.kind) {
    case 'weaponLevel':
      choice.weapon.level++;
      return;
    case 'newWeapon':
      build.weapons.push(new Weapon(choice.def));
      return;
    case 'mutation':
      choice.weapon.mutation = choice.mutation;
      choice.weapon.level++; // la mutation est le niveau 6
      return;
    case 'passive': {
      const level = build.passiveLevels.get(choice.passive.id) ?? 0;
      build.passiveLevels.set(choice.passive.id, level + 1);
      applyPassive(build.player, choice.passive);
      return;
    }
    case 'heal':
      build.player.heal(HEAL_UPGRADE.amount);
      return;
  }
}

/** Un niveau de passif. Les pourcentages portent sur la valeur de base (bonus additifs). */
function applyPassive(player: Player, passive: PassiveDef): void {
  switch (passive.stat) {
    case 'maxHp':
      player.maxHp += passive.amount;
      player.heal(passive.amount);
      return;
    case 'speedPct':
      player.speed += PLAYER_BASE.speed * passive.amount;
      return;
    case 'pickupPct':
      player.pickupRadius += PLAYER_BASE.pickupRadius * passive.amount;
      return;
    case 'damagePct':
      player.damageMult += passive.amount;
      return;
    case 'cooldownPct':
      player.cooldownMult -= passive.amount;
      return;
    case 'knockbackPct':
      player.knockbackMult += passive.amount;
      return;
    case 'sizePct':
      player.sizeMult += passive.amount;
      return;
    case 'velocityPct':
      player.projectileSpeedMult += passive.amount;
      return;
    case 'extraCount':
      player.extraCount += passive.amount;
      return;
  }
}

/**
 * Recalcule toutes les stats du joueur données par les passifs, à partir de leurs niveaux
 * (menu de test : on peut BAISSER un passif, ce que le level up ne fait jamais). Les PV
 * actuels sont gardés, sans dépasser le nouveau maximum.
 */
export function rebuildPassiveStats(
  player: Player,
  passiveLevels: ReadonlyMap<string, number>,
): void {
  const hp = player.hp;
  player.maxHp = PLAYER_BASE.maxHp;
  player.speed = PLAYER_BASE.speed;
  player.pickupRadius = PLAYER_BASE.pickupRadius;
  player.regen = PLAYER_BASE.regen;
  player.damageMult = 1;
  player.cooldownMult = 1;
  player.knockbackMult = 1;
  player.sizeMult = 1;
  player.projectileSpeedMult = 1;
  player.extraCount = 0;
  for (const passive of PASSIVES) {
    const level = passiveLevels.get(passive.id) ?? 0;
    for (let i = 0; i < level; i++) applyPassive(player, passive);
  }
  player.hp = Math.min(hp, player.maxHp);
}
