/* global console */
// Générateur des bruitages rétro : `node tools/audio/build-sfx.mjs`.
// Chaque son est décrit ici par une « recette » (couches d'ondes, glissement de hauteur, enveloppe),
// puis calculé échantillon par échantillon et écrit en WAV dans public/assets/audio/sfx/.
// Aucune dépendance : même principe que sfxr / ChipTone, mais les réglages restent dans le code,
// donc un son se retouche en changeant un chiffre, et tous les sons gardent le même « synthé ».
// Sons créés par nous : CC0, comme le reste de ce qu'on génère.
import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = join(ROOT, 'public', 'assets', 'audio', 'sfx');

const SAMPLE_RATE = 44100;
/** Crête maximale de chaque fichier : −1 dB, pour ne jamais saturer. */
const PEAK_DB = -1;
/** Fondu de fin (s) : couper une onde en plein milieu fait un « clic ». */
const END_FADE = 0.004;
/** Graine fixe : relancer le script redonne exactement les mêmes fichiers. */
const SEED = 1337;

// ---------------------------------------------------------------- recettes

// Une couche = une onde. Champs :
//   wave      'square' | 'triangle' | 'sine' | 'saw' | 'noise'
//   dur       durée de la couche (s) ; delay = départ décalé (s)
//   freq      hauteur de départ (Hz) ; to = hauteur d'arrivée (glissement exponentiel)
//   notes     suite de hauteurs jouées l'une après l'autre (arpège), step = durée d'une note
//   duty      rapport cyclique du carré (0.5 = carré plein, 0.125 = plus nasillard)
//   vib       { depth (fraction de la hauteur), rate (Hz) } : vibrato
//   attack    montée du volume (s) ; hold = part de la durée tenue au maximum ; curve = raideur
//             de la chute (1 = linéaire, plus grand = plus sec)
//   vol       volume relatif de la couche
// Pour le bruit, freq = vitesse à laquelle la valeur aléatoire change : grave = grondement,
// aigu = souffle. C'est le bruit « 8-bit » des vieilles consoles.

/** @type {Record<string, Array<Record<string, unknown>>>} */
const SOUNDS = {
  // Trait arcanique : « piou » magique, clair, pas agressif (il tire souvent).
  'bolt-shoot': [
    { wave: 'square', duty: 0.25, freq: 1300, to: 420, dur: 0.09, curve: 2, vol: 0.45 },
    {
      wave: 'sine',
      freq: 1900,
      to: 900,
      dur: 0.13,
      curve: 1.5,
      vol: 0.55,
      vib: { depth: 0.04, rate: 40 },
    },
  ],
  // Explosion du Trait éclaté : souffle qui s'assombrit + coup grave.
  'bolt-burst': [
    { wave: 'noise', freq: 4000, to: 250, dur: 0.34, curve: 2, vol: 0.8 },
    { wave: 'square', duty: 0.5, freq: 200, to: 45, dur: 0.22, curve: 2, vol: 0.5 },
  ],
  // Aura qui brûle : petit crépitement très court (joué en continu, doit se faire oublier).
  'aura-burn': [{ wave: 'noise', freq: 9000, to: 5000, dur: 0.06, curve: 3, vol: 1 }],
  // Orbe runique : « tink » cristallin.
  'orb-hit': [
    { wave: 'triangle', freq: 2100, to: 1600, dur: 0.09, curve: 2, vol: 0.7 },
    { wave: 'sine', freq: 3150, dur: 0.05, curve: 2, vol: 0.3 },
  ],
  // Épée : souffle qui balaie de l'aigu vers le grave (montée de 6 ms pour le « whoosh »).
  'sword-slash': [
    { wave: 'noise', freq: 11000, to: 1800, dur: 0.2, attack: 0.006, curve: 1.6, vol: 0.9 },
    { wave: 'square', duty: 0.125, freq: 700, to: 250, dur: 0.07, curve: 2, vol: 0.2 },
  ],
  // Ennemi touché : très sec (il y en a des centaines par minute).
  'enemy-hit': [
    { wave: 'square', duty: 0.5, freq: 320, to: 130, dur: 0.05, curve: 2.5, vol: 0.6 },
    { wave: 'noise', freq: 6000, dur: 0.025, curve: 2, vol: 0.4 },
  ],
  // Ennemi mort : petit « pop » qui descend.
  'enemy-death': [
    { wave: 'square', duty: 0.25, freq: 650, to: 90, dur: 0.13, curve: 1.8, vol: 0.6 },
    { wave: 'noise', freq: 2500, to: 800, dur: 0.08, curve: 2, vol: 0.4 },
  ],
  // Joueur touché : grave, rugueux, doit trancher avec tout le reste.
  'player-hurt': [
    {
      wave: 'saw',
      freq: 190,
      to: 70,
      dur: 0.26,
      curve: 1.5,
      vol: 0.6,
      vib: { depth: 0.08, rate: 30 },
    },
    { wave: 'noise', freq: 1800, to: 500, dur: 0.14, curve: 2, vol: 0.45 },
  ],
  // Gemme d'XP : deux notes très aiguës et rapides, légères.
  'gem-pickup': [
    { wave: 'sine', notes: [1760, 2637], step: 0.03, dur: 0.07, hold: 0.4, curve: 1.5, vol: 1 },
  ],
  // Pièce d'or : le « ding-ding » classique, deux notes montantes.
  'coin-pickup': [
    {
      wave: 'square',
      duty: 0.5,
      notes: [988, 1319],
      step: 0.05,
      dur: 0.18,
      hold: 0.3,
      curve: 1.5,
      vol: 0.55,
    },
    { wave: 'triangle', notes: [1976, 2637], step: 0.05, dur: 0.15, hold: 0.3, curve: 2, vol: 0.3 },
  ],
  // Potion : arpège doux qui monte.
  heal: [
    {
      wave: 'triangle',
      notes: [523, 659, 784, 1047],
      step: 0.07,
      dur: 0.36,
      hold: 0.6,
      curve: 1.5,
      vol: 0.8,
      vib: { depth: 0.01, rate: 12 },
    },
    {
      wave: 'sine',
      notes: [1047, 1319, 1568, 2093],
      step: 0.07,
      dur: 0.34,
      hold: 0.5,
      curve: 2,
      vol: 0.25,
    },
  ],
  // Caisse cassée : craquement de bois (bruit grave) + choc sourd.
  'crate-break': [
    { wave: 'noise', freq: 1400, to: 350, dur: 0.24, curve: 2.2, vol: 0.8 },
    { wave: 'square', duty: 0.5, freq: 150, to: 60, dur: 0.12, curve: 2, vol: 0.45 },
    { wave: 'noise', freq: 3000, dur: 0.05, delay: 0.06, curve: 2, vol: 0.35 },
  ],
  // Level up : arpège majeur qui monte, dernière note tenue.
  'level-up': [
    {
      wave: 'square',
      duty: 0.25,
      notes: [523, 659, 784, 1047, 1319],
      step: 0.08,
      dur: 0.72,
      hold: 0.65,
      curve: 1.5,
      vol: 0.45,
      vib: { depth: 0.006, rate: 7 },
    },
    {
      wave: 'triangle',
      notes: [262, 330, 392, 523, 659],
      step: 0.08,
      dur: 0.72,
      hold: 0.65,
      curve: 1.5,
      vol: 0.45,
    },
  ],
  // Charge du boss (avertissement) : sirène courte qui monte, menaçante.
  'boss-charge': [
    {
      wave: 'saw',
      freq: 140,
      to: 560,
      dur: 0.56,
      attack: 0.02,
      hold: 0.7,
      curve: 2,
      vol: 0.5,
      vib: { depth: 0.05, rate: 14 },
    },
    {
      wave: 'square',
      duty: 0.5,
      freq: 70,
      to: 280,
      dur: 0.56,
      attack: 0.02,
      hold: 0.7,
      curve: 2,
      vol: 0.4,
    },
  ],
  // Invocation (avertissement) : vibrato grave + souffle qui enfle.
  'boss-summon': [
    {
      wave: 'saw',
      freq: 110,
      to: 95,
      dur: 0.76,
      attack: 0.03,
      hold: 0.6,
      curve: 1.5,
      vol: 0.5,
      vib: { depth: 0.12, rate: 6 },
    },
    { wave: 'noise', freq: 400, to: 3500, dur: 0.76, attack: 0.4, hold: 0.2, curve: 2, vol: 0.45 },
  ],
  // Mort du boss : longue explosion qui s'éteint dans le grave.
  'boss-death': [
    { wave: 'noise', freq: 1600, to: 70, dur: 1.45, curve: 1.6, vol: 0.85 },
    { wave: 'square', duty: 0.5, freq: 220, to: 30, dur: 1.0, curve: 1.6, vol: 0.4 },
    {
      wave: 'saw',
      freq: 110,
      to: 25,
      dur: 1.45,
      curve: 1.3,
      vol: 0.3,
      vib: { depth: 0.1, rate: 9 },
    },
  ],
  // Survol d'un bouton : clic minuscule.
  'ui-hover': [{ wave: 'square', duty: 0.5, freq: 2400, to: 2200, dur: 0.025, curve: 2, vol: 0.5 }],
  // Clic : même famille, plus grave et un peu plus long.
  'ui-click': [
    { wave: 'square', duty: 0.5, freq: 1250, to: 850, dur: 0.06, curve: 2, vol: 0.55 },
    { wave: 'triangle', freq: 625, to: 425, dur: 0.06, curve: 2, vol: 0.45 },
  ],
  // ---- 0.3.1 : sons des armes du bloc C (ajoutés à la fin : les sons d'avant ne changent pas,
  // l'aléatoire du bruit est tiré dans l'ordre de la liste).
  // Éclair en chaîne, départ de la décharge : grésillement électrique (souffle très aigu + bourdon
  // en dents de scie secoué par un vibrato rapide, qui donne le « bzzz » de l'arc électrique).
  'chain-zap': [
    { wave: 'noise', freq: 14000, to: 5000, dur: 0.2, curve: 1.6, vol: 0.55 },
    {
      wave: 'saw',
      freq: 520,
      to: 260,
      dur: 0.2,
      curve: 1.4,
      vol: 0.5,
      vib: { depth: 0.35, rate: 70 },
    },
    {
      wave: 'square',
      duty: 0.125,
      freq: 2600,
      to: 1400,
      dur: 0.08,
      curve: 2,
      vol: 0.3,
      vib: { depth: 0.5, rate: 110 },
    },
  ],
  // Éclair en chaîne, ennemi touché : petite étincelle sèche (un coup par saut : doit rester court).
  'chain-hit': [
    { wave: 'noise', freq: 12000, to: 7000, dur: 0.045, curve: 2.5, vol: 0.6 },
    {
      wave: 'square',
      duty: 0.25,
      freq: 1700,
      to: 900,
      dur: 0.05,
      curve: 2.5,
      vol: 0.4,
      vib: { depth: 0.4, rate: 120 },
    },
  ],
  // Foudre de l'Orage : craquement puis grondement grave.
  thunder: [
    { wave: 'noise', freq: 9000, to: 1500, dur: 0.08, curve: 2, vol: 0.7 },
    { wave: 'noise', freq: 1200, to: 120, dur: 0.45, delay: 0.02, curve: 1.6, vol: 0.7 },
    {
      wave: 'saw',
      freq: 110,
      to: 45,
      dur: 0.4,
      delay: 0.02,
      curve: 1.6,
      vol: 0.3,
      vib: { depth: 0.12, rate: 11 },
    },
  ],
  // Hache lancée : souffle qui tourne (vibrato lent sur le bruit = « wou-wou » de la rotation).
  'axe-throw': [
    {
      wave: 'noise',
      freq: 3200,
      to: 1600,
      dur: 0.24,
      attack: 0.02,
      curve: 1.5,
      vol: 0.8,
      vib: { depth: 0.55, rate: 16 },
    },
  ],
  // Lame de métal qui entre (Hache, pointes des Chausse-trapes) : choc grave + tintement.
  'metal-hit': [
    { wave: 'square', duty: 0.5, freq: 240, to: 120, dur: 0.05, curve: 2.5, vol: 0.5 },
    { wave: 'triangle', freq: 1500, to: 1350, dur: 0.07, curve: 2.5, vol: 0.4 },
    { wave: 'noise', freq: 7000, dur: 0.02, curve: 2, vol: 0.35 },
  ],
  // Arc : corde qui claque (grave qui vibre) + flèche qui siffle.
  'bow-shoot': [
    {
      wave: 'triangle',
      freq: 330,
      to: 250,
      dur: 0.12,
      curve: 2,
      vol: 0.7,
      vib: { depth: 0.04, rate: 28 },
    },
    { wave: 'noise', freq: 7000, to: 2500, dur: 0.07, delay: 0.01, curve: 1.8, vol: 0.35 },
  ],
  // Chausse-trapes posées : pointes qui sortent de terre (coup sourd + raclement).
  'spike-place': [
    { wave: 'square', duty: 0.5, freq: 150, to: 80, dur: 0.07, curve: 2.2, vol: 0.5 },
    { wave: 'noise', freq: 2600, to: 900, dur: 0.11, curve: 1.8, vol: 0.55 },
  ],
  // Mine qui saute : gros « boum » grave + souffle qui retombe (plus lourd que bolt-burst).
  'mine-boom': [
    { wave: 'square', duty: 0.5, freq: 120, to: 32, dur: 0.38, curve: 1.8, vol: 0.7 },
    { wave: 'noise', freq: 3000, to: 160, dur: 0.55, curve: 1.6, vol: 0.9 },
    { wave: 'noise', freq: 9000, to: 2000, dur: 0.06, curve: 2.5, vol: 0.4 },
  ],
};

// ---------------------------------------------------------------- synthé

/** Aléatoire seedé (mulberry32), comme core/math.ts côté jeu. */
function makeRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Valeur d'une onde (−1 à 1) pour une phase entre 0 et 1. */
function oscillator(wave, phase, duty) {
  switch (wave) {
    case 'square':
      return phase < duty ? 1 : -1;
    case 'triangle':
      return 1 - 4 * Math.abs(phase - 0.5);
    case 'sine':
      return Math.sin(phase * 2 * Math.PI);
    case 'saw':
      return 2 * phase - 1;
    default:
      throw new Error(`onde inconnue : ${wave}`);
  }
}

/** Volume de la couche à l'instant t (0 à 1) : montée, palier, puis chute. */
function envelope(t, layer) {
  const attack = layer.attack ?? 0;
  if (t < attack) return t / attack;
  const holdEnd = attack + (layer.dur - attack) * (layer.hold ?? 0);
  if (t < holdEnd) return 1;
  const rest = layer.dur - holdEnd;
  const x = Math.min(1, (t - holdEnd) / rest);
  return Math.pow(1 - x, layer.curve ?? 1);
}

/** Hauteur de la couche à l'instant t (Hz). */
function frequencyAt(t, layer) {
  let freq;
  if (layer.notes) {
    const index = Math.min(layer.notes.length - 1, Math.floor(t / layer.step));
    freq = layer.notes[index];
  } else if (layer.to !== undefined) {
    freq = layer.freq * Math.pow(layer.to / layer.freq, t / layer.dur);
  } else {
    freq = layer.freq;
  }
  if (layer.vib) freq *= 1 + layer.vib.depth * Math.sin(2 * Math.PI * layer.vib.rate * t);
  return freq;
}

function renderLayer(out, layer, random) {
  const start = Math.round((layer.delay ?? 0) * SAMPLE_RATE);
  const count = Math.round(layer.dur * SAMPLE_RATE);
  const duty = layer.duty ?? 0.5;
  let phase = 0;
  let noiseValue = random() * 2 - 1;
  for (let i = 0; i < count && start + i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    phase += frequencyAt(t, layer) / SAMPLE_RATE;
    let value;
    if (layer.wave === 'noise') {
      // Nouvelle valeur aléatoire à chaque « tour » : la vitesse du tirage donne la hauteur du bruit.
      if (phase >= 1) noiseValue = random() * 2 - 1;
      value = noiseValue;
    } else {
      value = oscillator(layer.wave, phase % 1, duty);
    }
    phase %= 1;
    out[start + i] += value * envelope(t, layer) * (layer.vol ?? 1);
  }
}

function renderSound(layers, random) {
  const duration = Math.max(...layers.map((l) => (l.delay ?? 0) + l.dur));
  const out = new Float64Array(Math.ceil(duration * SAMPLE_RATE));
  for (const layer of layers) renderLayer(out, layer, random);

  // Coupe-bas à ~20 Hz : un carré non symétrique décale le signal (« DC »), ce qui gâche la crête.
  const r = 1 - (2 * Math.PI * 20) / SAMPLE_RATE;
  let prevIn = 0;
  let prevOut = 0;
  for (let i = 0; i < out.length; i++) {
    const y = out[i] - prevIn + r * prevOut;
    prevIn = out[i];
    prevOut = y;
    out[i] = y;
  }

  const fade = Math.round(END_FADE * SAMPLE_RATE);
  for (let i = 0; i < fade && i < out.length; i++) out[out.length - 1 - i] *= i / fade;

  // Tous les fichiers à la même crête : le volume de chaque son se règlera dans le jeu.
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const gain = Math.pow(10, PEAK_DB / 20) / peak;
  for (let i = 0; i < out.length; i++) out[i] *= gain;
  return out;
}

// ---------------------------------------------------------------- WAV

/** WAV PCM 16 bits mono. */
function encodeWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// ---------------------------------------------------------------- main

mkdirSync(OUT_DIR, { recursive: true });
const random = makeRandom(SEED);
for (const [name, layers] of Object.entries(SOUNDS)) {
  const samples = renderSound(layers, random);
  writeFileSync(join(OUT_DIR, `${name}.wav`), encodeWav(samples));
  // Premier échantillon audible : doit être tout au début (le son part à l'instant du coup).
  const firstLoud = samples.findIndex((v) => Math.abs(v) > 0.05);
  console.log(
    `${name.padEnd(13)} ${(samples.length / SAMPLE_RATE).toFixed(3)} s  début audible à ${((firstLoud / SAMPLE_RATE) * 1000).toFixed(1)} ms`,
  );
}
console.log(`→ ${Object.keys(SOUNDS).length} sons dans ${OUT_DIR}`);
