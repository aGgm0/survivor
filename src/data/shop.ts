// Boutique : bonus permanents achetés avec l'or, appliqués au début de chaque partie
// (voir CLAUDE.md § 5.9). Ils ne prennent pas d'emplacement de passif.

import { PLAYER_BASE } from './player';
import type { Profile } from './profile';

/** Stat améliorée par un bonus de boutique. */
export type ShopStat = 'maxHp' | 'damagePct' | 'speedPct' | 'pickupPct' | 'xpPct';

export interface ShopItemDef {
  readonly id: string;
  readonly name: string;
  /** Effet d'un rang (affiché dans la boutique) */
  readonly description: string;
  readonly stat: ShopStat;
  /** Gain par rang (fraction pour les `...Pct`) */
  readonly amount: number;
  /** Prix de chaque rang : prices[0] = rang 1. Le nombre de rangs = prices.length. */
  readonly prices: readonly number[];
}

export const SHOP_ITEMS: readonly ShopItemDef[] = [
  {
    id: 'startVitality',
    name: 'Vitalité de départ',
    description: '+5 PV max',
    stat: 'maxHp',
    amount: 5,
    prices: [50, 100, 150, 200, 250],
  },
  {
    id: 'startPower',
    name: 'Puissance de départ',
    description: '+3 % dégâts',
    stat: 'damagePct',
    amount: 0.03,
    prices: [80, 160, 240, 320, 400],
  },
  {
    id: 'startSwiftness',
    name: 'Célérité de départ',
    description: '+2 % vitesse',
    stat: 'speedPct',
    amount: 0.02,
    prices: [60, 120, 180],
  },
  {
    id: 'startAttraction',
    name: 'Attraction de départ',
    description: '+10 % aimant',
    stat: 'pickupPct',
    amount: 0.1,
    prices: [40, 80, 120],
  },
  {
    id: 'wisdom',
    name: 'Sagesse',
    description: '+3 % d’XP gagnée',
    stat: 'xpPct',
    amount: 0.03,
    prices: [100, 200, 300, 400, 500],
  },
];

/** Rang acheté d'un bonus (0 = jamais acheté). */
export function shopRank(profile: Readonly<Profile>, id: string): number {
  return profile.shop[id] ?? 0;
}

/** Prix du prochain rang, ou null si le bonus est au maximum. */
export function nextPrice(item: ShopItemDef, rank: number): number | null {
  return item.prices[rank] ?? null;
}

/**
 * Achète le rang suivant si le joueur a assez d'or (modifie le profil). Renvoie vrai si
 * l'achat a eu lieu ; faux si le bonus est au maximum, inconnu, ou trop cher.
 */
export function buyShopItem(profile: Profile, id: string): boolean {
  const item = SHOP_ITEMS.find((i) => i.id === id);
  if (!item) return false;
  const rank = shopRank(profile, id);
  const price = nextPrice(item, rank);
  if (price === null || profile.gold < price) return false;
  profile.gold -= price;
  profile.shop[id] = rank + 1;
  return true;
}

/** Ce que les bonus de boutique modifient au début d'une partie. */
export interface ShopTarget {
  maxHp: number;
  speed: number;
  pickupRadius: number;
  damageMult: number;
}

/**
 * Applique les rangs achetés (modifie `target`) et renvoie le multiplicateur d'XP gagnée.
 * Les pourcentages portent sur la valeur de base, comme les passifs.
 */
export function applyShopBonuses(
  target: ShopTarget,
  ranks: Readonly<Record<string, number>>,
): number {
  let xpMult = 1;
  for (const item of SHOP_ITEMS) {
    const rank = Math.min(ranks[item.id] ?? 0, item.prices.length);
    if (rank <= 0) continue;
    const gain = item.amount * rank;
    switch (item.stat) {
      case 'maxHp':
        target.maxHp += gain;
        break;
      case 'damagePct':
        target.damageMult += gain;
        break;
      case 'speedPct':
        target.speed += PLAYER_BASE.speed * gain;
        break;
      case 'pickupPct':
        target.pickupRadius += PLAYER_BASE.pickupRadius * gain;
        break;
      case 'xpPct':
        xpMult += gain;
        break;
    }
  }
  return xpMult;
}
