import { MusicPlayer } from './MusicPlayer';
import { SoundLimiter, jitteredRate, type SoundSettings } from './SoundLimiter';

/** Ce que le jeu demande au moteur audio : jouer un son par son nom. */
export interface SoundPlayer<N extends string> {
  play(name: N): void;
}

interface CompressorSettings {
  threshold: number;
  knee: number;
  ratio: number;
  attack: number;
  release: number;
}

/** Un son chargé : ses données décodées, son volume (un GainNode réutilisé) et son limiteur. */
interface LoadedSound {
  buffer: AudioBuffer;
  gain: GainNode;
  limiter: SoundLimiter;
  settings: SoundSettings;
}

/**
 * Son du jeu via la Web Audio API (pas `<audio>` : trop lent à démarrer pour des centaines de
 * bruitages par minute). Chaque bruitage est décodé une fois en mémoire, puis rejoué à la demande.
 * Chaînes (chaque « bus » = un volume réglable) :
 *   bruitage → volume du son → bus effets → compresseur ─┐
 *   musique (MusicPlayer) ───────────────→ bus musique ──┴→ volume général → haut-parleurs
 * Ne connaît rien du gameplay : les noms et réglages viennent de data/audio.ts via main.ts.
 */
export class AudioEngine<N extends string> implements SoundPlayer<N> {
  private readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly sfxBus: GainNode;
  private readonly musicBus: GainNode;
  private readonly sounds = new Map<N, LoadedSound>();
  /** Vrai une fois le son débloqué par le joueur (premier clic ou première touche) */
  private unlocked = false;

  /** @param base volumes de base des effets et de la musique (multipliés par les réglages) */
  constructor(
    compressor: CompressorSettings,
    private readonly base: { sfx: number; music: number },
  ) {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    // Le compresseur ne protège que les effets : la musique est déjà mise au bon niveau.
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = compressor.threshold;
    comp.knee.value = compressor.knee;
    comp.ratio.value = compressor.ratio;
    comp.attack.value = compressor.attack;
    comp.release.value = compressor.release;
    comp.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(comp);
    this.musicBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.setVolumes(1, 1, 1);
    this.unlockOnFirstInput();
    this.silenceWhenHidden();
  }

  /** Réglages du joueur (0 à 1) : volume général, musique, effets. */
  setVolumes(master: number, music: number, sfx: number): void {
    this.master.gain.value = master;
    this.musicBus.gain.value = music * this.base.music;
    this.sfxBus.gain.value = sfx * this.base.sfx;
  }

  /** Lecteur de musique branché sur le bus musique. */
  createMusicPlayer<M extends string>(
    tracks: Readonly<Record<M, { loop: boolean; volume: number }>>,
    url: (name: M) => string,
    timing: { fade: number; duck: number },
  ): MusicPlayer<M> {
    return new MusicPlayer(this.ctx, this.musicBus, tracks, url, timing);
  }

  /**
   * Charge tous les sons en arrière-plan. Un fichier manquant ou illisible est signalé puis
   * ignoré : le jeu tourne sans ce son plutôt que de planter.
   */
  async load(dir: string, extension: string, sounds: Readonly<Record<N, SoundSettings>>) {
    const names = Object.keys(sounds) as N[];
    await Promise.all(
      names.map(async (name) => {
        try {
          const res = await fetch(`${dir}${name}${extension}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
          const settings = sounds[name];
          const gain = this.ctx.createGain();
          gain.gain.value = settings.volume;
          gain.connect(this.sfxBus);
          this.sounds.set(name, { buffer, gain, limiter: new SoundLimiter(settings), settings });
        } catch (error: unknown) {
          console.warn(`Son « ${name} » non chargé :`, error);
        }
      }),
    );
  }

  play(name: N): void {
    // Son bloqué par le navigateur (pas encore de clic) ou pas encore chargé : on n'insiste pas.
    if (this.ctx.state !== 'running') return;
    const sound = this.sounds.get(name);
    if (!sound) return;
    // Hauteur aléatoire : Math.random et pas l'aléatoire seedé du jeu, le son ne change rien à la
    // partie (même seed → même partie, avec ou sans son).
    const rate = jitteredRate(sound.settings.pitchJitter, Math.random());
    const now = this.ctx.currentTime;
    if (!sound.limiter.tryStart(now, sound.buffer.duration / rate)) return;
    // Une source par lecture : c'est la seule façon de faire en Web Audio (une source ne sert
    // qu'une fois). Le limiteur borne leur nombre, et elles se libèrent seules à la fin du son.
    const source = this.ctx.createBufferSource();
    source.buffer = sound.buffer;
    source.playbackRate.value = rate;
    source.connect(sound.gain);
    source.start(now);
  }

  /**
   * Les navigateurs bloquent le son tant que le joueur n'a pas interagi avec la page :
   * le premier clic ou la première touche le débloque.
   */
  private unlockOnFirstInput(): void {
    const unlock = (): void => {
      void this.ctx.resume().then(() => {
        this.unlocked = true;
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      });
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  /** Onglet caché : tout le son s'arrête (la musique reprend où elle en était au retour). */
  private silenceWhenHidden(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.ctx.suspend();
      else if (this.unlocked) void this.ctx.resume();
    });
  }
}
