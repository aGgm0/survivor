import type { Rng } from '../core/math';
import { PLAYER_BASE } from '../data/player';
import { HEAL_UPGRADE, PASSIVES, type PassiveDef } from '../data/upgrades';
import { weaponMaxLevel } from '../data/weapons';
import type { Player } from '../entities/Player';
import type { Weapon } from '../entities/Weapon';

/** Un choix proposé au level up. Les champs d'affichage sont communs à tous les types. */
export type UpgradeChoice = {
  readonly title: string;
  readonly description: string;
  /** Ex. "Niv 3", "Nouveau" */
  readonly levelText: string;
} & (
  | { readonly kind: 'weaponLevel'; readonly weapon: Weapon }
  | { readonly kind: 'passive'; readonly passive: PassiveDef }
  | { readonly kind: 'heal' }
);

/** Ce dont le système d'upgrades a besoin (et qu'il modifie). */
export interface Build {
  readonly player: Player;
  readonly weapons: readonly Weapon[];
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
  for (const passive of PASSIVES) {
    const level = build.passiveLevels.get(passive.id) ?? 0;
    if (level >= passive.maxLevel) continue;
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
 */
export function rollUpgradeChoices(
  options: readonly UpgradeChoice[],
  rng: Rng,
  count: number,
): UpgradeChoice[] {
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

/** Applique le choix du joueur. Les armes doivent ensuite recalculer leurs stats (voir GameScene). */
export function applyUpgrade(choice: UpgradeChoice, build: Build): void {
  switch (choice.kind) {
    case 'weaponLevel':
      choice.weapon.level++;
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
  }
}
