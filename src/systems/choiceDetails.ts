// Détails d'une carte de level up : niveau actuel, ce qui change (avant → après) et la ligne de
// portée du bas. Logique pure, sans DOM : calculée une fois au level up, testée à part.

import { MAX_PASSIVES, MAX_WEAPONS } from '../data/progression';
import { GOLD_UPGRADE, HEAL_UPGRADE, type PassiveDef } from '../data/upgrades';
import { weaponMaxLevel } from '../data/weapons';
import { Weapon } from '../entities/Weapon';
import type { Build, UpgradeChoice } from './upgrades';

/** Une stat qui change, avec sa valeur avant et après (déjà mises en forme). */
export interface StatChange {
  readonly label: string;
  readonly before: string;
  readonly after: string;
}

export interface ChoiceDetails {
  /** Niveau actuel (0 : pas encore possédé) et niveau max, pour les crans ; absents : pas de crans */
  readonly level?: number;
  readonly maxLevel?: number;
  readonly changes: readonly StatChange[];
  /** Bas de la carte : ce que l'upgrade touche, ou l'emplacement qu'il prend */
  readonly scope: string;
  /** Pourquoi la carte apparaît (soin, or : tout est au maximum) */
  readonly reason?: string;
}

/** Nombre à la française (virgule), sans décimale inutile. */
function fmt(n: number, decimals = 0): string {
  const rounded = Number(n.toFixed(decimals));
  return String(rounded).replace('.', ',');
}

/** Stats comparables d'une arme, mises en forme ; seules celles qui changent seront montrées. */
function weaponStats(w: Weapon): [string, string][] {
  const stats: [string, string][] = [['dégâts', fmt(Math.ceil(w.damage))]];
  switch (w.def.kind) {
    case 'projectile':
      stats.push(['projectiles', fmt(w.count)], ['délai', `${fmt(w.cooldown, 2)} s`]);
      break;
    case 'aura':
      stats.push(['rayon', `${fmt(w.radius)} px`], ['délai', `${fmt(w.cooldown, 2)} s`]);
      break;
    case 'orbit':
      stats.push(['orbes', fmt(w.count)], ['orbite', `${fmt(w.orbitDistance)} px`]);
      break;
    case 'melee':
      stats.push(
        ['ouverture', `${fmt((w.arc * 180) / Math.PI)}°`],
        ['portée', `${fmt(w.range)} px`],
        ['délai', `${fmt(w.cooldown, 2)} s`],
      );
      break;
  }
  return stats;
}

/** Ce qui change entre l'arme actuelle et la même au niveau suivant (avec les passifs du joueur). */
function weaponLevelChanges(weapon: Weapon, build: Build): StatChange[] {
  const next = new Weapon(weapon.def);
  next.level = weapon.level + 1;
  next.recompute(build.player);
  const before = weaponStats(weapon);
  const after = weaponStats(next);
  const changes: StatChange[] = [];
  for (let i = 0; i < before.length; i++) {
    const [label, a] = before[i] ?? ['', ''];
    const b = after[i]?.[1] ?? '';
    if (a !== b) changes.push({ label, before: a, after: b });
  }
  return changes;
}

/** Bonus total d'un passif à `level` niveaux, mis en forme selon sa stat. */
function passiveTotal(passive: PassiveDef, level: number): string {
  const n = passive.amount * level;
  switch (passive.stat) {
    case 'maxHp':
      return `+${fmt(n)}`;
    case 'extraCount':
      return `+${fmt(n)}`;
    // La Hâte RÉDUIT le délai : même signe que sa description (« −8 % cooldown »)
    case 'cooldownPct':
      return `−${fmt(n * 100)} %`;
    default:
      return `+${fmt(n * 100)} %`;
  }
}

function passiveChanges(passive: PassiveDef, level: number): StatChange[] {
  const label = passive.stat === 'maxHp' ? 'PV max' : 'total';
  const changes: StatChange[] = [
    { label, before: passiveTotal(passive, level), after: passiveTotal(passive, level + 1) },
  ];
  if (passive.regenPerLevel) {
    changes.push({
      label: 'régénération',
      before: `+${fmt(passive.regenPerLevel * level, 1)} PV/s`,
      after: `+${fmt(passive.regenPerLevel * (level + 1), 1)} PV/s`,
    });
  }
  return changes;
}

export function describeChoice(choice: UpgradeChoice, build: Build): ChoiceDetails {
  switch (choice.kind) {
    case 'weaponLevel':
      return {
        level: choice.weapon.level,
        maxLevel: weaponMaxLevel(choice.weapon.def),
        changes: weaponLevelChanges(choice.weapon, build),
        scope: choice.weapon.def.scope,
      };
    case 'newWeapon':
      return {
        level: 0,
        maxLevel: weaponMaxLevel(choice.def),
        changes: [],
        scope: `${choice.def.scope} · emplacement ${build.weapons.length + 1} / ${MAX_WEAPONS}`,
      };
    case 'mutation':
      return { changes: [], scope: 'Choix parmi 2 · ne se change plus' };
    case 'passive': {
      const level = build.passiveLevels.get(choice.passive.id) ?? 0;
      const slot =
        level === 0 ? ` · emplacement ${build.passiveLevels.size + 1} / ${MAX_PASSIVES}` : '';
      return {
        level,
        maxLevel: choice.passive.maxLevel,
        changes: passiveChanges(choice.passive, level),
        scope: `${choice.passive.scope}${slot}`,
      };
    }
    case 'heal': {
      const { hp, maxHp } = build.player;
      return {
        changes: [
          {
            label: 'PV',
            before: fmt(hp),
            after: `${fmt(Math.min(maxHp, hp + HEAL_UPGRADE.amount))} / ${fmt(maxHp)}`,
          },
        ],
        scope: 'Immédiat',
        reason: 'Tout est au maximum',
      };
    }
    case 'gold': {
      const gold = build.gold ?? 0;
      return {
        changes: [{ label: 'or', before: fmt(gold), after: fmt(gold + GOLD_UPGRADE.amount) }],
        scope: 'Immédiat',
        reason: 'Tout est au maximum',
      };
    }
  }
}
