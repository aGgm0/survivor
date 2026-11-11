// Profil du joueur : statistiques cumulées sur toutes les parties, sauvegardées dans localStorage.
// Même principe que les réglages (data/settings.ts) : format versionné, relu sans confiance.

import type { RunReport } from '../systems/runReport';
import { SHOP_ITEMS } from './shop';
import { WEAPON_LIST } from './weapons';

export const PROFILE_KEY = 'survivor.profile';
export const PROFILE_VERSION = 1;

/** Cumul pour une arme (mutée ou non, comptée sous l'arme de base). */
export interface WeaponStats {
  /** Parties terminées avec cette arme dans l'inventaire */
  runs: number;
  damage: number;
  kills: number;
}

export interface Profile {
  /** Parties terminées (mort ou victoire). Une partie quittée en cours ne compte pas. */
  runs: number;
  victories: number;
  /** s : plus longue survie (sans fin compris : au-delà du dernier boss, c'est forcément du sans fin) */
  bestTime: number;
  /** s : temps survécu, toutes parties confondues */
  totalTime: number;
  totalKills: number;
  /** Plus haut niveau atteint */
  bestLevel: number;
  /** Par id d'arme de base */
  weapons: Record<string, WeaponStats>;
  /** Or disponible (gagné en partie, dépensé à la boutique) */
  gold: number;
  /** Rangs achetés à la boutique, par id de bonus (voir data/shop.ts) */
  shop: Record<string, number>;
  /** Défis tout-ou-rien déjà réussis (ex. boss tué avec une arme), par id */
  challenges: string[];
}

export function emptyProfile(): Profile {
  return {
    runs: 0,
    victories: 0,
    bestTime: 0,
    totalTime: 0,
    totalKills: 0,
    bestLevel: 0,
    weapons: {},
    challenges: [],
    gold: 0,
    shop: {},
  };
}

/** Ajoute une partie terminée au profil (modifie et renvoie le même objet). */
export function recordRun(profile: Profile, report: RunReport): Profile {
  profile.runs++;
  if (report.victory) profile.victories++;
  profile.bestTime = Math.max(profile.bestTime, report.time);
  profile.totalTime += report.time;
  profile.totalKills += report.kills;
  profile.gold += report.gold;
  profile.bestLevel = Math.max(profile.bestLevel, report.level);
  for (const id of report.challenges) {
    if (!profile.challenges.includes(id)) profile.challenges.push(id);
  }
  for (const w of report.weapons) {
    const stats = (profile.weapons[w.id] ??= { runs: 0, damage: 0, kills: 0 });
    stats.runs++;
    stats.damage += w.damage;
    stats.kills += w.kills;
  }
  return profile;
}

/** L'arme la plus jouée (le plus de parties, puis le plus de dégâts), ou null si aucune. */
export function favoriteWeapon(profile: Readonly<Profile>): string | null {
  let best: string | null = null;
  let bestStats: WeaponStats | null = null;
  for (const [id, stats] of Object.entries(profile.weapons)) {
    const better =
      !bestStats ||
      stats.runs > bestStats.runs ||
      (stats.runs === bestStats.runs && stats.damage > bestStats.damage);
    if (better) {
      best = id;
      bestStats = stats;
    }
  }
  return best;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Nombre positif et fini, sinon 0 (une valeur négative ou NaN ne doit pas passer). */
function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

const KNOWN_WEAPON_IDS = new Set(WEAPON_LIST.map((w) => w.id));

/** Relit une sauvegarde sans lui faire confiance : tout champ invalide repart de 0. */
export function parseProfile(raw: unknown): Profile {
  const profile = emptyProfile();
  if (!isRecord(raw)) return profile;
  if (typeof raw.version === 'number' && raw.version > PROFILE_VERSION) return profile;
  profile.runs = count(raw.runs);
  profile.victories = count(raw.victories);
  profile.bestTime = count(raw.bestTime);
  profile.totalTime = count(raw.totalTime);
  profile.totalKills = count(raw.totalKills);
  profile.bestLevel = count(raw.bestLevel);
  profile.gold = count(raw.gold);
  if (isRecord(raw.shop)) {
    for (const [id, rank] of Object.entries(raw.shop)) {
      // Un bonus retiré du jeu (ou inventé) est ignoré ; le rang est borné au maximum.
      const item = SHOP_ITEMS.find((i) => i.id === id);
      const r = Math.floor(count(rank));
      if (item && r > 0) profile.shop[id] = Math.min(r, item.prices.length);
    }
  }
  if (isRecord(raw.weapons)) {
    for (const [id, stats] of Object.entries(raw.weapons)) {
      // Une arme retirée du jeu (ou un id inventé) est ignorée.
      if (!KNOWN_WEAPON_IDS.has(id) || !isRecord(stats)) continue;
      profile.weapons[id] = {
        runs: count(stats.runs),
        damage: count(stats.damage),
        kills: count(stats.kills),
      };
    }
  }
  if (Array.isArray(raw.challenges)) {
    for (const id of raw.challenges) {
      if (typeof id === 'string' && !profile.challenges.includes(id)) profile.challenges.push(id);
    }
  }
  return profile;
}

export function serializeProfile(profile: Readonly<Profile>): Record<string, unknown> {
  return { version: PROFILE_VERSION, ...profile };
}
