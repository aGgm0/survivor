/* global console */
// Essai (0.4) : le tank redessiné en démon à partir de l'orc `ogre` du pack 0x72 (CC0).
// `node tools/sprites/tank-demon.mjs` → atlas des monstres faits maison, chargé en plus de celui du
// pack : public/assets/sprites/monsters/monsters.png (8 images de 32 × 36 : 4 au repos puis 4 en
// course) et monsters_list (même format que tile_list du pack). Comparaison : tools/sprites/variants-preview.html
// Cornes en croissant, choisies parmi 3 essais (petites, grandes, croissant) le 2026-11-21.
// On part d'un vrai dessin du pack plutôt que de zéro : même style, mêmes animations.
import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crop, readPng, writePng } from '../ui/png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ATLAS = join(ROOT, 'public', 'assets', 'sprites', '0x72', '0x72_DungeonTilesetII_v1.7.png');
const OUT_DIR = join(ROOT, 'public', 'assets', 'sprites', 'monsters');
/** Nom des animations dans la liste (data/sprites.ts : ENEMY_SPRITES.tank). */
const ANIM = 'tank_demon';

const FRAME_W = 32;
const FRAME_H = 36;
/** x des 8 images de l'ogre dans l'atlas (y 380), d'après tile_list_v1.7. */
const FRAMES_X = [16, 48, 80, 112, 144, 176, 208, 240];
const FRAMES_Y = 380;

/** Couleurs de l'ogre → palette des démons du pack (chort, big_demon). */
const RECOLOR = {
  '3d734f': 'da4e38', // peau verte → rouge
  314152: '9f294e', // ombre bleu-gris → cramoisi
  '8f4029': '5f2d56', // pagne brun → violet
  '62232f': '3a1c38', // ombre du pagne → violet sombre
};
const INK = '222222';
const BONE = 'fdf7ed';
const SHADE = '9f294e';

/**
 * Pixels ajoutés, relatifs au coin gauche du trait du haut de la tête (x 13 dans l'image ;
 * sa hauteur change d'une image à l'autre : la tête monte et descend en marchant).
 * La corne droite est le miroir de la gauche : x → 9 − x.
 */
/** Corne en croissant : monte vers l'extérieur puis se recourbe vers l'intérieur, pointe en haut. */
const CRESCENT_HORN = [
  [-1, -7, INK],
  [0, -7, INK],
  [-2, -6, INK],
  [-1, -6, BONE],
  [0, -6, INK],
  [-3, -5, INK],
  [-2, -5, BONE],
  [-1, -5, INK],
  [-3, -4, INK],
  [-2, -4, BONE],
  [-1, -4, INK],
  [-3, -3, INK],
  [-2, -3, BONE],
  [-1, -3, BONE],
  [0, -3, INK],
  [-2, -2, INK],
  [-1, -2, BONE],
  [0, -2, BONE],
  [1, -2, INK],
  [-1, -1, INK],
  [0, -1, BONE],
  [1, -1, BONE],
  [2, -1, INK],
  // Le trait noir du haut de la tête reste sous la corne (comme chez le chort), et une ombre
  // cramoisie sous sa base intérieure fait la transition avec la peau.
  [1, 1, SHADE],
];
const mirrored = (horn) => horn.map(([dx, dy, c]) => [9 - dx, dy, c]);
/** Œil de face (2 × 2) en blanc, comme les démons du pack. */
const FACE = [
  [3, 5, BONE],
  [4, 5, BONE],
  [3, 6, BONE],
  [4, 6, BONE],
];
const PATCH = [...CRESCENT_HORN, ...mirrored(CRESCENT_HORN), ...FACE];
const HEAD_X = 13;

const rgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hexOf = (d, i) =>
  [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');

/** Hauteur du trait du haut de la tête : 1re ligne avec 10 pixels pleins d'affilée. */
function headTop(img) {
  for (let y = 0; y < img.height; y++) {
    let run = 0;
    for (let x = 0; x < img.width; x++) {
      run = img.data[(y * img.width + x) * 4 + 3] ? run + 1 : 0;
      if (run >= 10) return y;
    }
  }
  throw new Error('tête introuvable');
}

/**
 * 2e œil, vu de profil sur le bord droit de la tête (x 22) : en blanc. Seulement x 22 : x 23 est
 * le contour, et le blanchir quand la tête déborde d'un pixel collait l'œil à la défense
 * (on croyait voir la dent monter pendant l'animation).
 */
function whitenSideEye(img, top) {
  for (const dy of [5, 6]) img.data.set([...rgb(BONE), 255], ((top + dy) * FRAME_W + 22) * 4);
}

function demonFrame(atlas, x, patch) {
  const img = crop(atlas, [x, FRAMES_Y, FRAME_W, FRAME_H]);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const to = d[i + 3] ? RECOLOR[hexOf(d, i)] : undefined;
    if (to) d.set(rgb(to), i);
  }
  const top = headTop(img);
  for (const [dx, dy, color] of patch) {
    const px = HEAD_X + dx;
    const py = top + dy;
    if (px >= 0 && py >= 0) d.set([...rgb(color), 255], (py * FRAME_W + px) * 4);
  }
  whitenSideEye(img, top);
  return img;
}

const atlas = readPng(ATLAS);
const width = FRAME_W * FRAMES_X.length;
const out = { width, height: FRAME_H, data: Buffer.alloc(width * FRAME_H * 4) };
FRAMES_X.forEach((x, n) => {
  const f = demonFrame(atlas, x, PATCH);
  for (let y = 0; y < FRAME_H; y++) {
    f.data.copy(out.data, (y * width + n * FRAME_W) * 4, y * FRAME_W * 4, (y + 1) * FRAME_W * 4);
  }
});
mkdirSync(OUT_DIR, { recursive: true });
writePng(join(OUT_DIR, 'monsters.png'), out);
const list = FRAMES_X.map((_, n) => {
  const anim = n < 4 ? 'idle' : 'run';
  return `${ANIM}_${anim}_anim_f${n % 4} ${n * FRAME_W} 0 ${FRAME_W} ${FRAME_H}`;
});
writeFileSync(join(OUT_DIR, 'monsters_list'), `${list.join('\n')}\n`);
console.log(`Atlas des monstres : ${OUT_DIR}`);
