import { lerp, normalizeInto, type Vec2 } from '../core/math';
import { PLAYER_BASE } from '../data/player';
import { computeDamage } from '../systems/damage';
import { frameAt, type SpriteAtlas } from '../core/SpriteAtlas';
import { HIT_FLASH_TINT, PLAYER_SPRITE, type SpriteDef } from '../data/sprites';

const PLAYER_COLOR = '#8a6cff';
/** Couleur et durée (s) du flash quand le joueur prend un coup */
const HIT_FLASH_COLOR = '#ffffff';
const HIT_FLASH_TIME = 0.1;
/** Barre de PV sous le joueur (lisible en pleine action ; le HUD donne le chiffre exact). */
const HP_BAR = {
  width: 40,
  height: 5,
  /** px sous le bas du joueur */
  offset: 8,
  background: '#1a1a1a',
  fill: '#ff4d4f',
  /** Contour sombre : sans lui, la barre rouge se perd au milieu des ennemis rouges/orange. */
  outline: '#000',
  outlineWidth: 2,
} as const;

export class Player {
  x = 0;
  y = 0;
  /** Position à l'update précédente : sert à l'interpolation au rendu. */
  prevX = 0;
  prevY = 0;
  /** Vitesse actuelle en px/s (sert à transmettre l'élan aux ennemis que le joueur bouscule). */
  vx = 0;
  vy = 0;
  speed: number = PLAYER_BASE.speed;
  readonly radius: number = PLAYER_BASE.radius;
  maxHp: number = PLAYER_BASE.maxHp;
  hp: number = PLAYER_BASE.maxHp;
  armor: number = PLAYER_BASE.armor;
  /** px : les gemmes d'XP dans ce rayon sont attirées */
  pickupRadius: number = PLAYER_BASE.pickupRadius;
  /** Multiplicateurs appliqués à toutes les armes (modifiés par les passifs) */
  damageMult = 1;
  cooldownMult = 1;
  knockbackMult = 1;
  /** Taille des projectiles, orbes, aura, explosions (passif Taille) */
  sizeMult = 1;
  /** Vitesse des projectiles et rotation des orbes (passif Vélocité) */
  projectileSpeedMult = 1;
  /** Projectiles / orbes en plus (passif Duplicateur) */
  extraCount = 0;
  /** Secondes de flash restantes (retour visuel d'un coup reçu, aucun effet de jeu). */
  hitFlashTimer = 0;
  /** Temps (s) qui fait avancer l'animation du sprite (aucun effet de jeu). */
  animTime = 0;
  /** Apparence (celle du perso choisi) : purement visuel */
  sprite: SpriteDef = PLAYER_SPRITE;

  /** Direction regardée (vecteur de longueur 1) : vers la droite au départ */
  facingX = 1;
  facingY = 0;

  // Réutilisé à chaque update pour ne pas allouer d'objet.
  private readonly dir: Vec2 = { x: 0, y: 0 };

  get isDead(): boolean {
    return this.hp <= 0;
  }

  /**
   * `axisX` / `axisY` valent -1, 0 ou 1 (directions demandées par le joueur).
   * On reçoit des nombres plutôt que l'Input : Player reste testable sans clavier.
   */
  update(dt: number, axisX: number, axisY: number): void {
    this.syncPrevious();
    this.animTime += dt;
    if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    // Sans normalisation, la diagonale (1, 1) a une longueur de ~1,41 : on irait 41 % plus vite.
    normalizeInto(axisX, axisY, this.dir);
    // Direction du regard (Épée) : la dernière direction de marche, gardée à l'arrêt.
    if (axisX !== 0 || axisY !== 0) {
      this.facingX = this.dir.x;
      this.facingY = this.dir.y;
    }
    this.vx = this.dir.x * this.speed;
    this.vy = this.dir.y * this.speed;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  /**
   * Encaisse un coup de `rawDamage` (avant armure). Pas d'invincibilité : c'est chaque ennemi
   * qui a son propre délai entre deux coups (voir GameScene). Renvoie vrai si le coup a porté.
   */
  takeHit(rawDamage: number): boolean {
    if (this.isDead) return false;
    this.hp = Math.max(0, this.hp - computeDamage(rawDamage, this.armor));
    this.hitFlashTimer = HIT_FLASH_TIME;
    return true;
  }

  /** Rend des PV, sans dépasser le maximum. */
  heal(amount: number): void {
    if (this.isDead) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /** Aligne la position précédente sur l'actuelle (début d'update, pause, téléportation). */
  syncPrevious(): void {
    this.prevX = this.x;
    this.prevY = this.y;
  }

  renderX(alpha: number): number {
    return lerp(this.prevX, this.x, alpha);
  }

  renderY(alpha: number): number {
    return lerp(this.prevY, this.y, alpha);
  }

  /** `sprites` absent (image pas encore chargée, ou introuvable) : on dessine un cercle. */
  render(ctx: CanvasRenderingContext2D, alpha: number, sprites?: SpriteAtlas | null): void {
    const x = this.renderX(alpha);
    const y = this.renderY(alpha);
    const flashing = this.hitFlashTimer > 0;

    const moving = this.vx !== 0 || this.vy !== 0;
    const look = this.sprite;
    const anim = sprites?.animation(moving ? look.run : look.idle);
    const frame = anim && frameAt(anim, this.animTime, look.frameTime);
    if (sprites && frame) {
      // Pieds posés sur le bas de la hitbox : le sprite dépasse vers le haut, comme un perso debout.
      const tint = flashing ? HIT_FLASH_TINT : undefined;
      sprites.draw(ctx, frame, x, y + this.radius, look.scale, this.facingX < 0, tint);
    } else {
      ctx.fillStyle = flashing ? HIT_FLASH_COLOR : PLAYER_COLOR;
      ctx.beginPath();
      ctx.arc(x, y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const barX = x - HP_BAR.width / 2;
    const barY = y + this.radius + HP_BAR.offset;
    ctx.strokeStyle = HP_BAR.outline;
    ctx.lineWidth = HP_BAR.outlineWidth;
    ctx.strokeRect(barX, barY, HP_BAR.width, HP_BAR.height);
    ctx.fillStyle = HP_BAR.background;
    ctx.fillRect(barX, barY, HP_BAR.width, HP_BAR.height);
    ctx.fillStyle = HP_BAR.fill;
    ctx.fillRect(barX, barY, HP_BAR.width * Math.max(0, this.hp / this.maxHp), HP_BAR.height);
  }
}
