// Profil du joueur : statistiques cumulées sur toutes les parties, sauvegardées dans localStorage.
// Même principe que les réglages (data/settings.ts) : format versionné, relu sans confiance.

import type { RunReport } from '../types/RunReport';
import { SHOP_ITEMS } from './shop';
import { PASSIVES } from './upgrades';
import { GAME_VERSION } from './version';
import { WEAPON_LIST } from './weapons';

export const PROFILE_KEY = 'survivor.profile';
export const PROFILE_VERSION = 1;
/** Parties gardées dans l'historique du Profil (les plus récentes) */
export const HISTORY_SIZE = 5;

/** Clé de la variante « sans mutation » dans `WeaponStats.variants` */
export const NO_MUTATION = 'base';

/** Cumul d'une variante d'arme (sans mutation, ou avec une de ses mutations). */
export interface VariantStats {
  runs: number;
  damage: number;
  kills: number;
}

/** Cumul pour une arme (mutée ou non, comptée sous l'arme de base). */
export interface WeaponStats {
  /** Parties terminées avec cette arme dans l'inventaire */
  runs: number;
  damage: number;
  kills: number;
  /**
   * Détail par variante (`NO_MUTATION` ou id de mutation), pour le Profil. Vide pour les parties
   * jouées avant la 0.3.7 : elles ne comptent que dans les totaux ci-dessus.
   */
  variants: Record<string, VariantStats>;
}

/** Une arme dans l'historique : de quoi afficher son icône, son niveau et sa part des dégâts. */
export interface HistoryWeapon {
  id: string;
  /** Icône : celle de la mutation si l'arme est mutée */
  icon: string;
  short: string;
  level: number;
  /** Part des dégâts de la partie, de 0 à 1 */
  share: number;
}

/** Résumé d'une partie terminée, pour l'historique du Profil. */
export interface HistoryEntry {
  /** id du perso (data/characters.ts) ; '' si inconnu */
  character: string;
  victory: boolean;
  endless: boolean;
  /** s survécues */
  time: number;
  kills: number;
  gold: number;
  level: number;
  /** s : build complet, null s'il ne l'a jamais été */
  maxedAt: number | null;
  /** ms depuis 1970 : quand la partie a été enregistrée */
  at: number;
  weapons: HistoryWeapon[];
  passives: { id: string; level: number }[];
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
  /** Dernières parties terminées, la plus récente en premier (HISTORY_SIZE au plus) */
  history: HistoryEntry[];
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
    history: [],
  };
}

/**
 * Ajoute une partie terminée au profil (modifie et renvoie le même objet). `now` : date de la
 * partie pour l'historique (ms depuis 1970), passée par les tests.
 */
export function recordRun(profile: Profile, report: RunReport, now = Date.now()): Profile {
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
    const stats = (profile.weapons[w.id] ??= { runs: 0, damage: 0, kills: 0, variants: {} });
    stats.runs++;
    stats.damage += w.damage;
    stats.kills += w.kills;
    // Ce qui a été fait avant la mutation compte « sans mutation », le reste pour la mutation ;
    // une partie compte dans chaque variante où l'arme a servi.
    if (w.mutation) {
      const before = { damage: w.damageBeforeMutation, kills: w.killsBeforeMutation };
      if (before.damage > 0 || before.kills > 0) {
        addVariant(stats, NO_MUTATION, before.damage, before.kills);
      }
      addVariant(stats, w.mutation, w.damage - before.damage, w.kills - before.kills);
    } else {
      addVariant(stats, NO_MUTATION, w.damage, w.kills);
    }
  }
  profile.history.unshift({
    character: report.character,
    victory: report.victory,
    endless: report.endless,
    time: report.time,
    kills: report.kills,
    gold: report.gold,
    level: report.level,
    maxedAt: report.maxedAt,
    at: now,
    weapons: report.weapons.map((w) => ({
      id: w.id,
      icon: w.icon,
      short: w.short,
      level: w.level,
      share: w.share,
    })),
    passives: report.passives.map((p) => ({ id: p.id, level: p.level })),
  });
  profile.history.length = Math.min(profile.history.length, HISTORY_SIZE);
  return profile;
}

function addVariant(stats: WeaponStats, key: string, damage: number, kills: number): void {
  const variant = (stats.variants[key] ??= { runs: 0, damage: 0, kills: 0 });
  variant.runs++;
  variant.damage += Math.max(0, damage);
  variant.kills += Math.max(0, kills);
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
/** Icônes possibles d'une arme de l'historique : l'arme ou une de ses mutations */
const KNOWN_ICON_IDS = new Set(
  WEAPON_LIST.flatMap((w) => [w.id, ...(w.mutations ?? []).map((m) => m.id)]),
);
const KNOWN_PASSIVE_IDS = new Set(PASSIVES.map((p) => p.id));

/** ids des mutations d'une arme */
function mutationIds(weaponId: string): string[] {
  return (WEAPON_LIST.find((w) => w.id === weaponId)?.mutations ?? []).map((m) => m.id);
}

/**
 * Une partie de l'historique relue sans confiance : null si elle est abîmée ; une arme ou un
 * passif inconnu (retiré du jeu) est simplement enlevé.
 */
function parseHistoryEntry(raw: unknown): HistoryEntry | null {
  if (!isRecord(raw) || typeof raw.victory !== 'boolean') return null;
  const weapons: HistoryWeapon[] = [];
  if (Array.isArray(raw.weapons)) {
    for (const w of raw.weapons) {
      if (!isRecord(w) || typeof w.id !== 'string' || !KNOWN_WEAPON_IDS.has(w.id)) continue;
      const icon = typeof w.icon === 'string' && KNOWN_ICON_IDS.has(w.icon) ? w.icon : w.id;
      weapons.push({
        id: w.id,
        icon,
        short: typeof w.short === 'string' ? w.short.slice(0, 3) : '',
        level: Math.floor(count(w.level)),
        share: Math.min(1, count(w.share)),
      });
    }
  }
  const passives: { id: string; level: number }[] = [];
  if (Array.isArray(raw.passives)) {
    for (const p of raw.passives) {
      if (!isRecord(p) || typeof p.id !== 'string' || !KNOWN_PASSIVE_IDS.has(p.id)) continue;
      passives.push({ id: p.id, level: Math.floor(count(p.level)) });
    }
  }
  return {
    character: typeof raw.character === 'string' ? raw.character : '',
    victory: raw.victory,
    endless: raw.endless === true,
    time: count(raw.time),
    kills: count(raw.kills),
    gold: count(raw.gold),
    level: Math.floor(count(raw.level)),
    maxedAt: typeof raw.maxedAt === 'number' && raw.maxedAt >= 0 ? raw.maxedAt : null,
    at: count(raw.at),
    weapons,
    passives,
  };
}

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
      const variants: Record<string, VariantStats> = {};
      if (isRecord(stats.variants)) {
        // Seulement « sans mutation » et les mutations de cette arme (une mutation retirée est ignorée).
        const known = new Set([NO_MUTATION, ...mutationIds(id)]);
        for (const [key, v] of Object.entries(stats.variants)) {
          if (!known.has(key) || !isRecord(v)) continue;
          variants[key] = { runs: count(v.runs), damage: count(v.damage), kills: count(v.kills) };
        }
      }
      profile.weapons[id] = {
        runs: count(stats.runs),
        damage: count(stats.damage),
        kills: count(stats.kills),
        variants,
      };
    }
  }
  if (Array.isArray(raw.challenges)) {
    for (const id of raw.challenges) {
      if (typeof id === 'string' && !profile.challenges.includes(id)) profile.challenges.push(id);
    }
  }
  // Ancienne sauvegarde : pas d'historique, il commence vide.
  if (Array.isArray(raw.history)) {
    for (const item of raw.history) {
      const entry = parseHistoryEntry(item);
      if (entry && profile.history.length < HISTORY_SIZE) profile.history.push(entry);
    }
  }
  return profile;
}

export function serializeProfile(profile: Readonly<Profile>): Record<string, unknown> {
  // savedWith : version du jeu qui a écrit la sauvegarde (ignorée à la lecture, utile aux migrations).
  return { version: PROFILE_VERSION, savedWith: GAME_VERSION, ...profile };
}
