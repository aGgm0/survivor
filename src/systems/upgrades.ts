import type { DamageType } from '../data/combat';
import type { Rng } from '../core/math';
import { PLAYER_BASE } from '../data/player';
import { MAX_PASSIVES, MAX_WEAPONS } from '../data/progression';
import { GOLD_UPGRADE, HEAL_UPGRADE, PASSIVES, type PassiveDef } from '../data/upgrades';
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
  | { readonly kind: 'gold' }
);

/** Icône d'un choix : id de l'arme, de la mutation ou du passif, ou `heal` / `gold` (fin de build). */
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
    case 'gold':
      return choice.kind;
  }
}

/**
 * Identifiant stable d'un choix : `availableUpgrades` recrée des objets à chaque appel, on ne
 * peut donc pas comparer les cartes par référence.
 */
export function choiceKey(choice: UpgradeChoice): string {
  return `${choice.kind}:${choiceIconId(choice) ?? ''}`;
}

/** Ce dont le système d'upgrades a besoin (et qu'il modifie). */
export interface Build {
  readonly player: Player;
  /** Modifiable : une nouvelle arme s'y ajoute */
  readonly weapons: Weapon[];
  /** Niveau de chaque passif possédé (absent = 0) */
  readonly passiveLevels: Map<string, number>;
  /** Or de la partie (carte « +10 or » quand tout est au maximum) */
  gold?: number;
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
 * `exclude` (relance) : ces cartes ne reviennent que s'il n'y a pas assez d'autres options,
 * sinon une relance pourrait reproposer exactement les mêmes cartes.
 * `passiveWeight` : chances relatives d'une carte de passif (0,5 = deux fois moins souvent
 * qu'une carte d'arme). 1 = tirage uniforme.
 * `missingType` : type de dégâts absent du build (toutes ses armes sont de l'autre type). Si
 * aucune nouvelle arme de ce type n'est sortie alors qu'il en reste, une carte est remplacée
 * par l'une d'elles (de préférence une nouvelle arme de l'autre type : la garantie de nouvelle
 * arme tient toujours).
 */
export function rollUpgradeChoices(
  options: readonly UpgradeChoice[],
  rng: Rng,
  count: number,
  guaranteeNewWeapon = false,
  exclude: readonly UpgradeChoice[] = [],
  passiveWeight = 1,
  missingType: DamageType | null = null,
): UpgradeChoice[] {
  let picks: UpgradeChoice[];
  let fresh: readonly UpgradeChoice[] = options;
  if (exclude.length === 0 || options.length === 0) {
    picks = shufflePick(options, rng, count, passiveWeight);
  } else {
    const excludedKeys = new Set(exclude.map(choiceKey));
    fresh = options.filter((c) => !excludedKeys.has(choiceKey(c)));
    const stale = options.filter((c) => excludedKeys.has(choiceKey(c)));
    picks = fresh.length > 0 ? shufflePick(fresh, rng, count, passiveWeight) : [];
    // Pas assez de nouvelles cartes : on complète avec des anciennes.
    if (picks.length < count && stale.length > 0) {
      picks.push(...shufflePick(stale, rng, count - picks.length, passiveWeight));
    }
  }
  if (guaranteeNewWeapon && !picks.some((c) => c.kind === 'newWeapon')) {
    const freshWeapons = fresh.filter((c) => c.kind === 'newWeapon');
    const newWeapons =
      freshWeapons.length > 0 ? freshWeapons : options.filter((c) => c.kind === 'newWeapon');
    const forced = newWeapons[rng.int(0, newWeapons.length - 1)];
    if (forced) {
      if (picks.length < count) picks.push(forced);
      else picks[picks.length - 1] = forced;
    }
  }
  if (missingType) guaranteeType(picks, options, fresh, rng, count, missingType);
  return picks;
}

/** Vrai pour une carte de nouvelle arme de type `type`. */
function newWeaponOfType(c: UpgradeChoice, type: DamageType): boolean {
  return c.kind === 'newWeapon' && c.def.damageType === type;
}

/** Voir `missingType` de rollUpgradeChoices. Modifie `picks`. */
function guaranteeType(
  picks: UpgradeChoice[],
  options: readonly UpgradeChoice[],
  fresh: readonly UpgradeChoice[],
  rng: Rng,
  count: number,
  type: DamageType,
): void {
  if (picks.some((c) => newWeaponOfType(c, type))) return;
  const freshOfType = fresh.filter((c) => newWeaponOfType(c, type));
  const candidates =
    freshOfType.length > 0 ? freshOfType : options.filter((c) => newWeaponOfType(c, type));
  const forced = candidates[rng.int(0, candidates.length - 1)];
  if (!forced) return;
  if (picks.length < count) {
    picks.push(forced);
    return;
  }
  // On remplace une nouvelle arme de l'autre type s'il y en a une, sinon la dernière carte.
  const otherWeapon = picks.findIndex((c) => c.kind === 'newWeapon');
  picks[otherWeapon >= 0 ? otherWeapon : picks.length - 1] = forced;
}

/**
 * Type de dégâts qui manque au build : celui qu'aucune arme n'a, si toutes sont du même type.
 * null s'il n'y a pas d'arme ou si les deux types sont déjà là.
 */
export function missingDamageType(weapons: readonly Weapon[]): DamageType | null {
  const first = weapons[0];
  if (!first) return null;
  const type = first.damageType;
  if (weapons.some((w) => w.damageType !== type)) return null;
  return type === 'physical' ? 'magical' : 'physical';
}

function shufflePick(
  options: readonly UpgradeChoice[],
  rng: Rng,
  count: number,
  passiveWeight = 1,
): UpgradeChoice[] {
  if (options.length === 0) {
    return [
      {
        kind: 'heal',
        title: HEAL_UPGRADE.name,
        description: HEAL_UPGRADE.description,
        levelText: '',
      },
      {
        kind: 'gold',
        title: GOLD_UPGRADE.name,
        description: GOLD_UPGRADE.description,
        levelText: '',
      },
    ];
  }
  if (passiveWeight !== 1) return weightedPick(options, rng, count, passiveWeight);
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

/**
 * Tirage sans doublon où chaque carte de passif pèse `passiveWeight` et les autres 1 :
 * on tire un nombre dans [0, poids total[, la carte dont la tranche le contient sort, et on
 * recommence sans elle. Seulement au level up : quelques tableaux créés, sans souci de perf.
 */
function weightedPick(
  options: readonly UpgradeChoice[],
  rng: Rng,
  count: number,
  passiveWeight: number,
): UpgradeChoice[] {
  const pool = options.slice();
  const picks: UpgradeChoice[] = [];
  const weightOf = (c: UpgradeChoice) => (c.kind === 'passive' ? passiveWeight : 1);
  while (picks.length < count && pool.length > 0) {
    let total = 0;
    for (const c of pool) total += weightOf(c);
    let roll = rng.next() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      if (!c) continue;
      roll -= weightOf(c);
      if (roll < 0) {
        index = i;
        break;
      }
    }
    const [picked] = pool.splice(index, 1);
    if (picked) picks.push(picked);
  }
  return picks;
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
      choice.weapon.setMutation(choice.mutation);
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
    case 'gold':
      build.gold = (build.gold ?? 0) + GOLD_UPGRADE.amount;
      return;
  }
}

/** Un niveau de passif. Les pourcentages portent sur la valeur de base (bonus additifs). */
function applyPassive(player: Player, passive: PassiveDef): void {
  player.regen += passive.regenPerLevel ?? 0;
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
    case 'penetration':
      player.penetration += passive.amount;
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
  player.penetration = 0;
  for (const passive of PASSIVES) {
    const level = passiveLevels.get(passive.id) ?? 0;
    for (let i = 0; i < level; i++) applyPassive(player, passive);
  }
  player.hp = Math.min(hp, player.maxHp);
}
