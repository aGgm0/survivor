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
 * Bruitages via la Web Audio API (pas `<audio>` : trop lent à démarrer pour des centaines de
 * sons par minute). Chaque son est décodé une fois en mémoire, puis rejoué à la demande.
 * Chaîne : source → volume du son → volume des effets → compresseur → haut-parleurs.
 * Ne connaît rien du gameplay : les noms et réglages viennent de data/audio.ts via main.ts.
 */
export class AudioEngine<N extends string> implements SoundPlayer<N> {
  private readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly sounds = new Map<N, LoadedSound>();

  constructor(compressor: CompressorSettings, masterVolume: number) {
    this.ctx = new AudioContext();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = compressor.threshold;
    comp.knee.value = compressor.knee;
    comp.ratio.value = compressor.ratio;
    comp.attack.value = compressor.attack;
    comp.release.value = compressor.release;
    comp.connect(this.ctx.destination);
    this.master = this.ctx.createGain();
    this.master.gain.value = masterVolume;
    this.master.connect(comp);
    this.unlockOnFirstInput();
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
          gain.connect(this.master);
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
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      });
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }
}
