// Menu de test (F2) : les modifications « pures » des armes et des passifs, sorties de GameScene.
// Elles ne connaissent pas la scène : la scène garde les actions qui touchent au déroulement de la
// partie (temps, niveaux, sans fin, or...), qui sont des règles du jeu.
// Chaque fonction renvoie `true` si quelque chose a changé : la scène recalcule alors les armes
// et redessine l'inventaire du HUD.

import { applyShopBonuses } from '../../data/shop';
import { PASSIVES } from '../../data/upgrades';
import { WEAPON_LIST, weaponMaxLevel } from '../../data/weapons';
import type { Player } from '../../entities/Player';
import { Weapon } from '../../entities/Weapon';
import { rebuildPassiveStats } from '../../systems/upgrades';
import type { DevView } from '../../ui/DevPanel';

/** Ajoute l'arme si on ne l'a pas, la retire sinon. */
export function devToggleWeapon(weapons: Weapon[], id: string): boolean {
  const index = weapons.findIndex((w) => w.def.id === id);
  if (index >= 0) {
    weapons.splice(index, 1);
    return true;
  }
  const def = WEAPON_LIST.find((d) => d.id === id);
  if (!def) return false;
  weapons.push(new Weapon(def));
  return true;
}

/** Monte ou baisse une arme dans ses niveaux normaux (1 à 5) ; retire sa mutation. */
export function devSetWeaponLevel(weapons: readonly Weapon[], id: string, delta: number): boolean {
  const w = weapons.find((x) => x.def.id === id);
  if (!w) return false;
  // La mutation (niveau 6) a ses propres boutons.
  w.mutation = null;
  w.level = Math.max(1, Math.min(weaponMaxLevel(w.def), w.level + delta));
  return true;
}

/** Donne la mutation n° `index` (niveau 6), ou la retire avec -1 (retour au niveau max normal). */
export function devSetMutation(weapons: readonly Weapon[], id: string, index: number): boolean {
  const w = weapons.find((x) => x.def.id === id);
  if (!w) return false;
  w.mutation = w.def.mutations?.[index] ?? null;
  w.level = weaponMaxLevel(w.def) + (w.mutation ? 1 : 0);
  return true;
}

/**
 * Monte ou baisse un passif, puis recalcule toutes les stats du joueur (on peut BAISSER un passif,
 * ce que le level up ne fait jamais).
 */
export function devSetPassive(
  player: Player,
  passiveLevels: Map<string, number>,
  shopRanks: Readonly<Record<string, number>>,
  id: string,
  delta: number,
): boolean {
  const passive = PASSIVES.find((p) => p.id === id);
  if (!passive) return false;
  const level = Math.max(
    0,
    Math.min(passive.maxLevel, (passiveLevels.get(passive.id) ?? 0) + delta),
  );
  if (level > 0) passiveLevels.set(passive.id, level);
  else passiveLevels.delete(passive.id);
  rebuildPassiveStats(player, passiveLevels);
  // Le recalcul repart des stats de base : on remet les bonus de boutique par-dessus.
  applyShopBonuses(player, shopRanks);
  return true;
}

/** Ce que le menu de test affiche. Créé seulement quand il est ouvert (pas en jeu). */
export function buildDevView(
  weapons: readonly Weapon[],
  passiveLevels: ReadonlyMap<string, number>,
  god: boolean,
): DevView {
  return {
    god,
    weapons: WEAPON_LIST.map((def) => {
      const w = weapons.find((x) => x.def.id === def.id);
      const mutation = w?.mutation ? (def.mutations?.indexOf(w.mutation) ?? -1) : -1;
      return { id: def.id, owned: !!w, level: w?.level ?? 0, mutation };
    }),
    passives: PASSIVES.map((p) => ({ id: p.id, level: passiveLevels.get(p.id) ?? 0 })),
  };
}
