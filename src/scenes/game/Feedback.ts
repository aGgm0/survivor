// Le ressenti de la partie : bruitages, tremblement de l'écran, particules, flash des ennemis
// touchés, nombres de dégâts. Écoute les événements de partie (RunEvents) ; ne change jamais une
// règle. Tout son aléatoire est séparé de celui du jeu : il ne change pas le déroulement.

import type { SoundPlayer } from '../../core/AudioEngine';
import type { Camera } from '../../core/Camera';
import { Rng } from '../../core/math';
import { ARROW_FIRE_SOUND, FIRE_SOUNDS, HIT_SOUNDS, type SfxName } from '../../data/audio';
import { AURA_LOOKS, AURA_PULSE, PARTICLES, RESISTED_NUMBERS, SHAKE_EVENTS } from '../../data/feel';
import type { Settings } from '../../data/settings';
import { STATUS } from '../../data/status';
import { BOSS_TYPE } from '../../data/waves';
import type { Enemy } from '../../entities/Enemy';
import type { Weapon } from '../../entities/Weapon';
import type { HitKind } from '../../systems/damage';
import type { DamageNumberSystem } from '../../systems/DamageNumberSystem';
import type { EffectsSystem } from '../../systems/EffectsSystem';
import type { ParticleSystem } from '../../systems/ParticleSystem';
import type { RunEvents } from '../../types/RunEvents';
import type { OneShotName } from '../../data/sprites';

/** s pendant lesquelles un ennemi touché est affiché en blanc */
const ENEMY_HIT_FLASH = 0.08;
/** s minimum entre la fin d'un flash et le suivant (un ennemi pris sous un gros DPS clignote) */
const ENEMY_FLASH_GAP = 0.25;
/** Constante quelconque pour dériver la seed des étincelles d'aura de celle du jeu */
const AURA_SEED_SALT = 0x27d4eb2f;

export interface FeedbackDeps {
  readonly camera: Camera;
  readonly particles: ParticleSystem;
  readonly effects: EffectsSystem;
  readonly damageNumbers: DamageNumberSystem;
  /** Réglages lus à chaque fois : ils changent dans les Options en pleine partie */
  readonly settings: () => Settings;
  /** Bruitages ; absent (tests, simulation) : partie muette */
  readonly sfx?: SoundPlayer<SfxName>;
  /** Temps de partie (s) */
  readonly now: () => number;
}

export class Feedback implements RunEvents {
  /** Aléatoire visuel des étincelles et des flammes d'aura */
  private readonly auraRng: Rng;
  /** Étincelles d'aura dues mais pas encore émises (fraction qui s'accumule d'une update à l'autre) */
  private auraSparkDebt = 0;

  constructor(
    private readonly deps: FeedbackDeps,
    seed: number,
  ) {
    this.auraRng = new Rng(seed ^ AURA_SEED_SALT);
  }

  /** Effets continus (étincelles des auras) : appelé à chaque update de la partie. */
  update(dt: number, weapons: readonly Weapon[], playerX: number, playerY: number): void {
    this.emitAuraSparks(dt, weapons, playerX, playerY);
  }

  /** Retour visuel d'un impact : son, flash blanc et nombre de dégâts au-dessus de l'ennemi. */
  enemyHit(e: Enemy, damage: number, kind: HitKind, source: Weapon, reduction: number): void {
    // Bruitage selon l'arme (le poison n'en a pas : il tique sans arrêt). Une caisse ne fait
    // pas de bruit d'impact, seulement celui de sa casse.
    if (kind === 'direct' && !e.type.prop) this.sound(HIT_SOUNDS[source.def.kind]);
    const { damageNumbers } = this.deps;
    const showNumbers = this.deps.settings().damageNumbers; // réglage Options
    if (kind === 'poison') {
      // Poison : nombre vert, sans flash (sinon les empoisonnés clignoteraient sans arrêt).
      if (showNumbers) damageNumbers.spawn(e.x, e.y - e.type.radius, damage, STATUS.poisonColor);
      return;
    }
    // Pas de nouveau flash juste après le précédent : sous un gros DPS, l'ennemi resterait blanc.
    const now = this.deps.now();
    if (now - e.flashUntil >= ENEMY_FLASH_GAP) e.flashUntil = now + ENEMY_HIT_FLASH;
    if (!showNumbers) return;
    // Coup bien réduit par la résistance : nombre gris (« cet ennemi encaisse ce type »).
    if (reduction >= RESISTED_NUMBERS.minReduction) {
      damageNumbers.spawn(e.x, e.y - e.type.radius, damage, RESISTED_NUMBERS.color);
    } else {
      damageNumbers.spawn(e.x, e.y - e.type.radius, damage);
    }
  }

  enemyKilled(e: Enemy): void {
    this.deathBurst(e);
    const boss = e.type === BOSS_TYPE;
    this.sound(boss ? 'boss-death' : 'enemy-death');
    if (boss) this.shake('bossKill');
    else if (e.type.elite) this.shake('eliteKill');
  }

  crateBroken(x: number, y: number, radius: number): void {
    this.deps.effects.chestOpen(x, y, radius);
    this.deps.particles.burst(x, y, PARTICLES.crate, PARTICLES.crateColor);
    this.sound('crate-break');
  }

  playerHit(): void {
    this.shake('playerHit');
    this.sound('player-hurt');
  }

  levelUp(x: number, y: number): void {
    this.sound('level-up');
    // Anneau d'étincelles : il part au moment du level up, puis reprend après le choix.
    this.deps.particles.burst(
      x,
      y,
      PARTICLES.levelUp,
      PARTICLES.levelUpColor,
      PARTICLES.levelUp.count,
      true,
    );
  }

  gemsPicked(): void {
    this.sound('gem-pickup');
  }

  goldPicked(): void {
    this.sound('coin-pickup');
  }

  healed(): void {
    this.sound('heal');
  }

  bossCharge(): void {
    this.shake('bossCharge');
  }

  chargeWarning(): void {
    this.sound('boss-charge');
  }

  summonWarning(): void {
    this.sound('boss-summon');
  }

  explosion(x: number, y: number, radius: number, color: string): void {
    this.deps.effects.explosion(x, y, radius, color);
    this.shake('explosion');
    this.sound('bolt-burst');
  }

  auraPulse(x: number, y: number, radius: number): void {
    this.emitPulseFlames(x, y, radius);
    this.shake('auraPulse');
    this.sound('bolt-burst');
  }

  slash(x: number, y: number, angle: number, arc: number, range: number, color: string): void {
    this.deps.effects.slash(x, y, angle, arc, range, color);
    this.sound('sword-slash');
  }

  thrust(x: number, y: number, angle: number, arc: number, range: number, color: string): void {
    this.deps.effects.thrust(x, y, angle, arc, range, color);
    this.sound('sword-slash');
  }

  effect(name: OneShotName, x: number, y: number, size: number, angle = 0): void {
    this.deps.effects.play(name, x, y, size, angle);
    // Les grosses explosions se sentent et s'entendent ; les étincelles restent discrètes.
    if (name === 'blast') {
      this.shake('mineBlast');
      this.sound('mine-boom');
    } else if (name === 'strike') {
      this.sound('thunder');
    }
  }

  fired(source: Weapon): void {
    const def = source.def;
    const name =
      def.kind === 'projectile' && def.look === 'arrow' ? ARROW_FIRE_SOUND : FIRE_SOUNDS[def.kind];
    if (name) this.sound(name);
  }

  uiClick(): void {
    this.sound('ui-click');
  }

  /** Bruitage (réglages et limites dans data/audio.ts). */
  private sound(name: SfxName): void {
    this.deps.sfx?.play(name);
  }

  /** Choc qui fait trembler l'écran (voir SHAKE_EVENTS dans data/feel.ts). */
  private shake(event: keyof typeof SHAKE_EVENTS): void {
    const { amount, cap } = SHAKE_EVENTS[event];
    this.deps.camera.addTrauma(amount, cap);
  }

  /** Éclats à la couleur du monstre : plus il est gros, plus il y en a ; une gerbe pour le boss. */
  private deathBurst(e: Enemy): void {
    const particles = this.deps.particles;
    if (e.type === BOSS_TYPE) {
      particles.burst(e.x, e.y, PARTICLES.bossDeath, e.type.color);
      return;
    }
    const d = PARTICLES.death;
    particles.burst(e.x, e.y, d, e.type.color, d.count + Math.round(e.type.radius * d.perRadius));
  }

  /** Onde de la Fournaise : des flammes jaillissent de toute la zone. */
  private emitPulseFlames(x: number, y: number, radius: number): void {
    const f = AURA_PULSE;
    const rng = this.auraRng;
    for (let i = 0; i < f.flames; i++) {
      // Point au hasard dans le disque (racine carrée : réparti partout, pas tassé au centre).
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next()) * radius;
      const color = f.flameColors[rng.int(0, f.flameColors.length - 1)] ?? f.flameColors[1];
      this.deps.particles.spawn(
        x + Math.cos(a) * d,
        y + Math.sin(a) * d,
        rng.range(-f.flameSpread, f.flameSpread),
        -f.flameRise * rng.range(0.6, 1),
        f.flameSize,
        f.flameLife * rng.range(0.6, 1),
        color,
      );
    }
  }

  /** Étincelles qui montent de l'intérieur des auras (celles qui ont une apparence AURA_LOOKS). */
  private emitAuraSparks(dt: number, weapons: readonly Weapon[], px: number, py: number): void {
    const rng = this.auraRng;
    for (const w of weapons) {
      if (w.def.kind !== 'aura') continue;
      const look = AURA_LOOKS[w.mutation?.id ?? w.def.id];
      if (!look) continue;
      this.auraSparkDebt += look.sparksPerSecond * dt;
      while (this.auraSparkDebt >= 1) {
        this.auraSparkDebt -= 1;
        // Point au hasard dans le disque (racine carrée : répartition uniforme, pas tassée au centre).
        const a = rng.range(0, Math.PI * 2);
        const d = Math.sqrt(rng.next()) * w.radius;
        this.deps.particles.spawn(
          px + Math.cos(a) * d,
          py + Math.sin(a) * d,
          rng.range(-15, 15),
          -look.sparkRise * rng.range(0.7, 1),
          look.sparkSize,
          look.sparkLife * rng.range(0.6, 1),
          look.sparkColor,
        );
      }
    }
  }
}
