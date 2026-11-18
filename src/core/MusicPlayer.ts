/** Ce que les scènes demandent à la musique. */
export interface MusicControl<N extends string> {
  /** Joue cette musique (fondu depuis la précédente). Rien ne change si elle joue déjà. */
  play(name: N): void;
  /** Baisse la musique (pause) ou la remet à son volume. */
  setDucked(ducked: boolean): void;
}

interface MusicSettings {
  loop: boolean;
  /** Volume propre du morceau (1 = normal) */
  volume: number;
}

interface Timing {
  fade: number;
  duck: number;
}

/**
 * Musique via la Web Audio API. Pourquoi pas `<audio loop>` : les navigateurs laissent un petit
 * blanc au raccord de la boucle ; une source Web Audio en `loop` repart à l'échantillon près.
 * Chaque morceau n'est chargé qu'au premier besoin (le boss n'est jamais chargé si on ne joue
 * pas), puis gardé en mémoire.
 * Chaîne : source → fondu du morceau → baisse de pause → volume musique (fourni par AudioEngine).
 */
export class MusicPlayer<N extends string> implements MusicControl<N> {
  private readonly buffers = new Map<N, Promise<AudioBuffer | null>>();
  private readonly duck: GainNode;
  /** La musique demandée en dernier (elle peut être encore en chargement) */
  private wanted: N | null = null;
  private current: { source: AudioBufferSourceNode; fade: GainNode } | null = null;

  constructor(
    private readonly ctx: AudioContext,
    output: AudioNode,
    private readonly tracks: Readonly<Record<N, MusicSettings>>,
    private readonly url: (name: N) => string,
    private readonly timing: Timing,
  ) {
    this.duck = ctx.createGain();
    this.duck.connect(output);
  }

  play(name: N): void {
    if (this.wanted === name) return;
    this.wanted = name;
    this.fadeOutCurrent();
    void this.load(name).then((buffer) => {
      // Entre-temps, une autre musique a pu être demandée : celle-ci ne doit plus partir.
      if (!buffer || this.wanted !== name) return;
      this.start(buffer, this.tracks[name]);
    });
  }

  /**
   * Charge un morceau à l'avance, sans le jouer. Pour les jingles de fin : chargés au moment de
   * la mort, ils partiraient en retard.
   */
  preload(name: N): void {
    void this.load(name);
  }

  setDucked(ducked: boolean): void {
    const gain = this.duck.gain;
    const now = this.ctx.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(ducked ? this.timing.duck : 1, now + 0.2);
  }

  private start(buffer: AudioBuffer, { loop, volume }: MusicSettings): void {
    const now = this.ctx.currentTime;
    const fade = this.ctx.createGain();
    if (loop) {
      fade.gain.setValueAtTime(0, now);
      fade.gain.linearRampToValueAtTime(volume, now + this.timing.fade);
    } else {
      // Jingle (moins d'une seconde) : plein volume tout de suite. Un fondu d'entrée de 0,8 s
      // le rendait presque muet.
      fade.gain.setValueAtTime(volume, now);
    }
    fade.connect(this.duck);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(fade);
    source.start(now);
    this.current = { source, fade };
  }

  private fadeOutCurrent(): void {
    if (!this.current) return;
    const { source, fade } = this.current;
    const now = this.ctx.currentTime;
    fade.gain.cancelScheduledValues(now);
    fade.gain.setValueAtTime(fade.gain.value, now);
    fade.gain.linearRampToValueAtTime(0, now + this.timing.fade);
    source.stop(now + this.timing.fade);
    // Une fois arrêtée, la source se débranche : le navigateur peut la libérer.
    source.onended = () => fade.disconnect();
    this.current = null;
  }

  /** Charge et décode un morceau une seule fois. Fichier manquant : signalé, musique muette. */
  private load(name: N): Promise<AudioBuffer | null> {
    let promise = this.buffers.get(name);
    if (!promise) {
      promise = fetch(this.url(name))
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.arrayBuffer();
        })
        .then((data) => this.ctx.decodeAudioData(data))
        .catch((error: unknown) => {
          console.warn(`Musique « ${name} » non chargée :`, error);
          return null;
        });
      this.buffers.set(name, promise);
    }
    return promise;
  }
}
