/* global console, process */
// Générateur des sprites en pixel art : `node tools/sprites/build.mjs [dossier d'aperçu]`.
// Les sprites sont décrits ici (grilles de caractères ou formes), puis écrits en PNG dans
// public/assets/sprites/. Aucune dépendance : le PNG est encodé à la main avec zlib.
// Pourquoi par code : un sprite reste modifiable pixel par pixel et le contour est le même partout.
import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = join(ROOT, 'public', 'assets', 'sprites');

/** Contour commun à tous les sprites (1 pixel d'art). */
const OUTLINE = '#07060c';
/** Un pixel d'art = 1 px à l'écran (résolution logique 1280 × 720). */
const GAME_SCALE = 1;

// ---------------------------------------------------------------- grille de pixels

function createGrid(width, height) {
  return Array.from({ length: height }, () => new Array(width).fill(null));
}

function setPixel(grid, x, y, color) {
  if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) grid[y][x] = color;
}

function fillEllipse(grid, cx, cy, rx, ry, color) {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) grid[y][x] = color;
    }
  }
}

/** Polygone plein (règle pair-impair, testée au centre de chaque pixel). */
function fillPoly(grid, points, color) {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) grid[y][x] = color;
    }
  }
}

function drawLine(grid, x0, y0, x1, y1, color) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    setPixel(
      grid,
      Math.round(x0 + ((x1 - x0) * i) / steps),
      Math.round(y0 + ((y1 - y0) * i) / steps),
      color,
    );
  }
}

/**
 * Dessine une forme avec du volume, sans placer chaque pixel à la main :
 * - bord en haut à gauche éclairé, bord en bas à droite dans l'ombre (lumière en haut à gauche) ;
 * - trait sombre autour de la forme là où elle recouvre une autre partie du sprite.
 * `tones` = [ombre, base, lumière] ; `parts` = fonctions qui remplissent un masque.
 */
function shape(grid, tones, parts, { rim = 1, edge = true } = {}) {
  const [dark, mid, light] = tones;
  const mask = createGrid(grid[0].length, grid.length);
  for (const part of parts) part(mask);
  const inside = (x, y) => mask[y]?.[x] === 1;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      if (inside(x, y)) continue;
      const touches = inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1);
      if (edge && touches && grid[y][x] !== null) grid[y][x] = OUTLINE;
    }
  }
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      if (!inside(x, y)) continue;
      let lit = false;
      let shaded = false;
      for (let k = 1; k <= rim; k++) {
        if (!inside(x, y - k) || !inside(x - k, y)) lit = true;
        if (!inside(x, y + k) || !inside(x + k, y)) shaded = true;
      }
      grid[y][x] = lit && !shaded ? light : shaded && !lit ? dark : mid;
    }
  }
}

/** Raccourcis pour décrire les parties d'une forme. */
const poly =
  (...points) =>
  (mask) =>
    fillPoly(mask, points, 1);
const oval = (cx, cy, rx, ry) => (mask) => fillEllipse(mask, cx, cy, rx, ry, 1);

/** Ajoute 1 pixel de marge et entoure la silhouette d'un contour sombre. */
function withOutline(grid) {
  const height = grid.length + 2;
  const width = grid[0].length + 2;
  const out = createGrid(width, height);
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) out[y + 1][x + 1] = grid[y][x];
  }
  const filled = (x, y) =>
    y >= 1 && y < height - 1 && x >= 1 && x < width - 1 && grid[y - 1][x - 1] !== null;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (out[y][x] !== null) continue;
      if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))
        out[y][x] = OUTLINE;
    }
  }
  return out;
}

// ---------------------------------------------------------------- image et PNG

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function createImage(width, height, background = null) {
  const data = Buffer.alloc(width * height * 4);
  if (background) {
    const [r, g, b] = hexToRgb(background);
    for (let i = 0; i < data.length; i += 4) data.set([r, g, b, 255], i);
  }
  return { width, height, data };
}

function fillRect(image, x0, y0, w, h, color) {
  const [r, g, b] = hexToRgb(color);
  for (let y = Math.max(0, y0); y < Math.min(image.height, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(image.width, x0 + w); x++) {
      image.data.set([r, g, b, 255], (y * image.width + x) * 4);
    }
  }
}

/** Dessine une grille dans l'image, centrée sur (cx, cy), chaque pixel d'art agrandi `scale` fois. */
function blit(image, grid, cx, cy, scale) {
  const left = Math.round(cx - (grid[0].length * scale) / 2);
  const top = Math.round(cy - (grid.length * scale) / 2);
  grid.forEach((row, y) => {
    row.forEach((color, x) => {
      if (color) fillRect(image, left + x * scale, top + y * scale, scale, scale, color);
    });
  });
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, body) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([head, typed, crc]);
}

function encodePng({ width, height, data }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8 bits par canal, RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function gridToImage(grid) {
  const image = createImage(grid[0].length, grid.length);
  blit(image, grid, grid[0].length / 2, grid.length / 2, 1);
  return image;
}

// ---------------------------------------------------------------- sprites

const BONE = ['#8f8068', '#d8ccb0', '#f6eedb'];
const BONE_FAR = ['#6e6250', '#a39274', '#cdbfa0'];

/** Joueur : mage encapuchonné de profil, cape au vent, bâton à cristal (#8a6cff). */
function buildPlayer() {
  const g = createGrid(32, 42);
  const robe = ['#2f2370', '#5a44c2', '#8a6cff'];
  const cloak = ['#1c1546', '#33277a', '#4a39a8'];
  const gold = ['#8f6f24', '#e0b84c', '#ffe9a0'];

  // Cape derrière le corps.
  shape(g, cloak, [poly([13, 12], [7, 20], [3, 36], [8, 33], [10, 38], [14, 34], [17, 20])]);
  drawLine(g, 11, 20, 7, 33, cloak[0]);

  // Bâton et cristal.
  shape(g, ['#4d351f', '#8a6238', '#b98a55'], [poly([26, 8], [28, 8], [28, 41], [26, 41])]);
  shape(g, ['#1f8fb0', '#55d8f0', '#e8fdff'], [poly([27, 0], [31, 4.5], [27, 9], [23, 4.5])]);
  setPixel(g, 26, 3, '#ffffff');
  setPixel(g, 26, 9, gold[1]);
  setPixel(g, 27, 9, gold[1]);

  // Bottes, robe, ceinture.
  shape(
    g,
    ['#120e1c', '#241c33', '#3a2e52'],
    [poly([13, 38], [17, 38], [18, 41], [13, 41]), poly([19, 38], [23, 38], [25, 41], [19, 41])],
  );
  shape(g, robe, [poly([12, 14], [21, 14], [23, 26], [25, 39], [10, 39], [11, 26])]);
  drawLine(g, 14, 28, 13, 38, robe[0]);
  drawLine(g, 18, 28, 18, 38, robe[0]);
  drawLine(g, 21, 28, 22, 38, robe[0]);
  drawLine(g, 16, 28, 15, 37, robe[2]);
  shape(g, gold, [poly([11, 24], [23, 24], [23, 26.5], [11, 26.5])]);
  setPixel(g, 19, 25, '#ffffff');
  // Liseré doré au bas de la robe.
  drawLine(g, 11, 37, 23, 37, gold[1]);

  // Capuche pointue vers l'arrière, visage dans l'ombre, yeux lumineux.
  shape(g, robe, [oval(17, 8, 6.5, 7), poly([13, 2], [6, 10], [13, 12])]);
  fillEllipse(g, 20.5, 9, 3.2, 4, '#0f0b1a');
  drawLine(g, 17, 5, 17, 12, robe[0]);
  setPixel(g, 20, 8, '#7df3ff');
  setPixel(g, 22, 8, '#7df3ff');
  setPixel(g, 20, 9, '#2a8fa8');
  setPixel(g, 22, 9, '#2a8fa8');

  // Bras tendu vers le bâton, main.
  shape(g, robe, [poly([14, 14], [20, 13], [26, 18], [25, 23], [16, 20])]);
  shape(g, ['#a8785c', '#e2b594', '#f6d9c0'], [poly([25, 18], [29, 18], [29, 22], [25, 22])]);
  return g;
}

/** Basique (palier 1) : diablotin voûté qui fonce, cornes en arrière, griffes en avant (#d9534f). */
function buildBasic() {
  const g = createGrid(32, 32);
  const skin = ['#4a121b', '#8a232a', '#d9534f'];
  const far = ['#22080f', '#451119', '#6b1a22'];
  const wing = ['#1a060c', '#3a0e17', '#5e1620'];

  // Queue à pointe, aile, corne et membres du fond.
  shape(g, far, [
    poly([10, 21], [5, 23], [2, 19], [1, 12], [3, 12], [4, 18], [6, 20], [10, 19]),
    poly([0, 13], [2, 8], [5, 13]),
  ]);
  shape(g, wing, [poly([14, 15], [5, 2], [3, 11], [6, 10], [6, 16], [9, 14], [11, 19])]);
  drawLine(g, 13, 15, 6, 5, wing[0]);
  drawLine(g, 12, 15, 7, 13, wing[0]);
  shape(g, BONE_FAR, [poly([22, 8], [25, 8], [25, 2], [22, 0], [23, 4])]);
  shape(g, far, [poly([19, 18], [26, 23], [25, 26], [18, 21])]);
  shape(g, far, [poly([11, 21], [15, 21], [14, 26], [17, 31], [11, 31], [10, 26])]);

  // Torse voûté, jambe avant.
  shape(g, skin, [oval(15, 19, 5.5, 5), oval(18, 17.5, 4.5, 4.5)]);
  drawLine(g, 13, 16, 16, 15, skin[0]); // échine
  shape(g, skin, [poly([15, 22], [20, 22], [20, 27], [25, 31], [18, 31], [16, 27])]);

  // Tête : museau, oreille pointue, corne.
  shape(g, skin, [oval(21, 11, 5, 4.5), poly([23, 8], [30, 12], [29, 16], [22, 16])]);
  shape(g, skin, [poly([18, 9], [12, 6], [18, 13])]);
  shape(g, BONE, [poly([18, 8], [21, 6], [18, 1], [12, 0], [16, 4])]);
  // Regard mauvais : arcade sombre inclinée, œil jaune, gueule ouverte à crocs.
  drawLine(g, 22, 9, 26, 11, OUTLINE);
  setPixel(g, 23, 11, '#ffd76a');
  setPixel(g, 24, 11, '#ffd76a');
  setPixel(g, 24, 12, '#ff8a3d');
  setPixel(g, 29, 12, OUTLINE);
  drawLine(g, 23, 14, 29, 14, OUTLINE);
  drawLine(g, 24, 15, 28, 15, '#2a0508');
  setPixel(g, 24, 14, BONE[2]);
  setPixel(g, 26, 14, BONE[2]);
  setPixel(g, 28, 14, BONE[2]);
  setPixel(g, 25, 15, BONE[2]);
  setPixel(g, 27, 15, BONE[2]);

  // Bras avant tendu, griffes.
  shape(g, skin, [poly([17, 17], [20, 16], [27, 19], [27, 22], [24, 22], [17, 20])]);
  drawLine(g, 27, 19, 29, 19, BONE[1]);
  drawLine(g, 27, 21, 29, 21, BONE[1]);
  drawLine(g, 26, 22, 28, 23, BONE[1]);
  drawLine(g, 25, 25, 27, 26, BONE_FAR[1]);
  return g;
}

/** Boss : seigneur démon ailé de profil, crâne cornu, cœur runique (#8e2de2). */
function buildBoss() {
  const g = createGrid(100, 100);
  const opt = { rim: 2 };
  const wingFar = ['#0f071c', '#1d0d33', '#2c1450'];
  const wing = ['#1d0d33', '#3a1b63', '#5a2c96'];
  const robe = ['#150c24', '#2b1b45', '#463069'];
  const arm = ['#3a1f63', '#6a32b3', '#a04df0'];
  const armFar = ['#24133f', '#45227a', '#6a32b3'];
  const glow = ['#8e2de2', '#d86bff', '#fbe6ff'];

  // Aile du fond, puis aile proche avec ses nervures.
  shape(
    g,
    wingFar,
    [poly([52, 40], [70, 14], [92, 5], [87, 22], [93, 28], [83, 34], [85, 45], [71, 42], [62, 52])],
    opt,
  );
  drawLine(g, 56, 40, 90, 7, wingFar[0]);
  drawLine(g, 58, 42, 91, 28, wingFar[0]);
  shape(
    g,
    wing,
    [
      poly(
        [42, 40],
        [26, 16],
        [7, 3],
        [3, 10],
        [2, 31],
        [10, 26],
        [10, 45],
        [18, 38],
        [20, 55],
        [28, 46],
        [36, 58],
      ),
    ],
    opt,
  );
  drawLine(g, 38, 40, 8, 6, wing[0]);
  drawLine(g, 37, 41, 4, 29, wing[0]);
  drawLine(g, 37, 43, 11, 43, wing[0]);
  drawLine(g, 37, 45, 20, 53, wing[0]);
  drawLine(g, 7, 3, 3, 10, wing[2]);

  // Bras du fond, tendu vers l'avant, griffes.
  shape(g, armFar, [poly([62, 40], [72, 43], [86, 56], [81, 63], [64, 52])], opt);
  shape(g, armFar, [oval(85, 61, 5.5, 4.5)], opt);
  drawLine(g, 89, 58, 95, 57, BONE_FAR[1]);
  drawLine(g, 90, 61, 96, 62, BONE_FAR[1]);
  drawLine(g, 88, 64, 93, 67, BONE_FAR[1]);

  // Robe en lambeaux, plis et runes.
  shape(
    g,
    robe,
    [
      poly(
        [30, 50],
        [68, 50],
        [73, 70],
        [79, 96],
        [71, 90],
        [66, 99],
        [59, 91],
        [52, 99],
        [46, 91],
        [40, 99],
        [34, 90],
        [26, 96],
        [28, 70],
      ),
    ],
    opt,
  );
  for (const [x0, x1] of [
    [38, 35],
    [46, 45],
    [54, 54],
    [62, 64],
    [68, 72],
  ]) {
    drawLine(g, x0, 66, x1, 90, robe[0]);
    drawLine(g, x0 + 2, 68, x1 + 2, 88, robe[2]);
  }
  for (const [x, y] of [
    [42, 78],
    [58, 82],
    [50, 72],
    [66, 76],
  ]) {
    setPixel(g, x, y, glow[1]);
    setPixel(g, x, y + 1, glow[0]);
  }

  // Torse en armure, cœur runique, ceinture.
  shape(g, arm, [oval(50, 46, 17, 14)], opt);
  drawLine(g, 40, 40, 44, 56, arm[0]);
  drawLine(g, 62, 38, 64, 54, arm[0]);
  drawLine(g, 38, 52, 62, 54, arm[0]);
  drawLine(g, 45, 36, 60, 36, arm[2]); // arête du plastron
  drawLine(g, 46, 55, 62, 56, arm[2]);
  for (const y of [40, 44, 48]) drawLine(g, 41, y, 47, y + 1, arm[0]); // côtes de l'armure
  shape(g, glow, [oval(55, 46, 6, 6)], opt);
  fillEllipse(g, 55, 46, 2, 2, '#ffffff');
  shape(g, ['#8f6f24', '#e0b84c', '#ffe9a0'], [poly([33, 57], [67, 57], [68, 61], [32, 61])]);
  shape(g, BONE, [oval(50, 60, 4, 4)]);
  setPixel(g, 48, 59, OUTLINE);
  setPixel(g, 51, 59, OUTLINE);
  setPixel(g, 49, 62, OUTLINE);
  setPixel(g, 51, 62, OUTLINE);

  // Capuche, corne du fond, crâne tourné vers la droite.
  shape(g, robe, [oval(53, 28, 12, 12)], opt);
  shape(g, BONE_FAR, [poly([59, 19], [64, 20], [68, 8], [64, 0], [63, 10])], opt);
  shape(g, BONE, [oval(57, 26, 8.5, 8), poly([58, 24], [70, 28], [69, 34], [56, 33])], opt);
  shape(g, BONE, [poly([55, 33], [67, 35], [65, 40], [57, 39])]); // mâchoire
  fillEllipse(g, 60.5, 26, 3.5, 3, OUTLINE);
  fillEllipse(g, 61, 26.5, 1.5, 1.5, '#ffe07a');
  setPixel(g, 61, 26, '#ffffff');
  drawLine(g, 56, 22, 64, 24, OUTLINE); // arcade
  setPixel(g, 67, 29, OUTLINE);
  setPixel(g, 67, 30, OUTLINE);
  setPixel(g, 68, 30, OUTLINE);
  drawLine(g, 58, 34, 68, 35, OUTLINE);
  for (let x = 59; x <= 67; x += 2) {
    setPixel(g, x, 33, OUTLINE);
    setPixel(g, x, 36, OUTLINE);
  }
  drawLine(g, 50, 24, 52, 32, BONE[0]);

  // Grande corne proche, couronne de flammes.
  shape(g, BONE, [poly([48, 24], [55, 19], [47, 5], [33, 0], [42, 10])], opt);
  drawLine(g, 47, 20, 41, 8, BONE[0]);
  shape(g, glow, [poly([56, 6], [53, 17], [59, 17]), poly([51, 11], [49, 17], [53, 17])]);

  // Épaulière à pointes, bras proche, main griffue.
  shape(g, BONE, [poly([27, 32], [20, 15], [33, 28]), poly([33, 28], [35, 13], [41, 29])]);
  shape(g, arm, [oval(34, 37, 10.5, 8)], opt);
  drawLine(g, 27, 38, 42, 40, arm[0]);
  shape(g, BONE, [poly([27, 52], [20, 58], [28, 58])]); // pointe du coude
  shape(g, arm, [poly([28, 41], [41, 43], [40, 55], [43, 67], [31, 69], [26, 56])], opt);
  drawLine(g, 28, 55, 40, 56, arm[0]);
  drawLine(g, 30, 62, 42, 61, arm[0]);
  drawLine(g, 30, 63, 42, 62, arm[2]);
  drawLine(g, 33, 45, 34, 53, arm[2]);
  shape(g, robe, [oval(36, 71, 6.5, 5)], opt);
  for (const x of [31, 34, 37, 40]) {
    drawLine(g, x, 73, x - 1, 80, BONE[1]);
    setPixel(g, x - 1, 81, BONE[0]);
  }
  return g;
}

// ---------------------------------------------------------------- effets (atlas fx)
// Ce que le pack 0x72 n'a pas. Le projectile et l'orbe sont en gris : le jeu les teinte à la
// couleur de l'arme (filtre « multiply »), un seul sprite sert donc à toutes les variantes.

/** Gemme d'XP taillée, vue de face : `width` px de large, facettes claires en haut à gauche. */
function buildGem(width, tones) {
  const height = Math.round(width * 1.3);
  const g = createGrid(width, height);
  const cx = width / 2;
  const girdle = Math.round(height * 0.38);
  shape(g, tones, [poly([cx, 0], [width, girdle], [cx, height], [0, girdle])], { edge: false });
  drawLine(g, 0, girdle, width - 1, girdle, tones[0]); // arête de la taille
  drawLine(g, Math.floor(cx), 1, Math.floor(cx), height - 2, tones[2]); // arête centrale
  setPixel(g, Math.floor(cx) - 1, 2, '#ffffff'); // reflet
  return withOutline(g);
}

/** Trait arcanique, tourné vers la droite : tête ronde et traînée qui s'effile. Deux images. */
function buildBolt(frame) {
  const g = createGrid(16, 8);
  const tones = ['#6f6f6f', '#bdbdbd', '#ffffff'];
  const tail = frame === 0 ? 0 : 2;
  shape(g, ['#3a3a3a', '#6f6f6f', '#9a9a9a'], [poly([tail, 4], [10, 2], [10, 6])], { edge: false });
  shape(g, tones, [oval(12, 4, 3.5, 3.5)], { edge: false });
  setPixel(g, 12, 3, '#ffffff');
  setPixel(g, 13, 3, '#ffffff');
  setPixel(g, 4 + frame * 2, frame === 0 ? 3 : 5, '#bdbdbd'); // étincelle de la traînée
  return g;
}

/** Orbe runique : sphère grise, rune claire qui pulse (deux images). */
function buildOrb(frame) {
  const g = createGrid(15, 15);
  shape(g, ['#4a4a4a', '#9a9a9a', '#e0e0e0'], [oval(7.5, 7.5, 7, 7)], { rim: 2, edge: false });
  const rune = frame === 0 ? '#ffffff' : '#d0d0d0';
  drawLine(g, 7, 3, 7, 11, rune);
  drawLine(g, 7, 3, 10, 6, rune);
  drawLine(g, 7, 7, 4, 10, rune);
  setPixel(g, 4, 4, '#ffffff');
  return g;
}

/**
 * Range des sprites côte à côte dans une seule image (1 px d'écart) et écrit la liste au même
 * format que celle du pack 0x72 (`nom x y largeur hauteur`) : le jeu les lit de la même façon.
 */
function writeAtlas(dir, name, entries) {
  const gap = 1;
  const width = entries.reduce((w, [, grid]) => w + grid[0].length + gap, 0);
  const height = Math.max(...entries.map(([, grid]) => grid.length));
  const image = createImage(width, height);
  const lines = [];
  let x = 0;
  for (const [id, grid] of entries) {
    blit(image, grid, x + grid[0].length / 2, grid.length / 2, 1);
    lines.push(`${id} ${x} 0 ${grid[0].length} ${grid.length}`);
    x += grid[0].length + gap;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.png`), encodePng(image));
  writeFileSync(join(dir, `${name}_list`), `${lines.join('\n')}\n`);
  console.log(`${name}.png : ${entries.length} sprites, ${width} × ${height} px`);
}

writeAtlas(join(OUT_DIR, 'fx'), 'fx', [
  // Largeurs = diamètre affiché / 2 (sprites dessinés ×2) : 14, 18 et 24 px dans le jeu.
  ['gem_1', buildGem(7, ['#1f6f9a', '#4fc3f7', '#c8f0ff'])],
  ['gem_2', buildGem(9, ['#5e3d9e', '#b388ff', '#e6d9ff'])],
  ['gem_3', buildGem(12, ['#9a7414', '#ffd54f', '#fff3c4'])],
  // Gemme verte boostée (basique) : un peu plus grosse que la bleue, couleur à part.
  ['gem_bonus', buildGem(8, ['#1f7a3a', '#5ee07a', '#d4ffd9'])],
  ['bolt_anim_f0', buildBolt(0)],
  ['bolt_anim_f1', buildBolt(1)],
  ['orb_anim_f0', buildOrb(0)],
  ['orb_anim_f1', buildOrb(1)],
]);

// ---------------------------------------------------------------- sortie

const sprites = {
  player: withOutline(buildPlayer()),
  basic: withOutline(buildBasic()),
  boss: withOutline(buildBoss()),
};

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, grid] of Object.entries(sprites)) {
  writeFileSync(join(OUT_DIR, `${name}.png`), encodePng(gridToImage(grid)));
  console.log(`${name}.png : ${grid[0].length} × ${grid.length} px`);
}

// Aperçu facultatif : à gauche les sprites à la taille du jeu sur son fond, à droite en gros plan.
const previewDir = process.argv[2];
if (previewDir) {
  const ZOOM = 4;
  const image = createImage(1180, 440, '#14141c');
  for (let x = 0; x < 400; x += 64) fillRect(image, x, 0, 1, 440, '#2c2c3d');
  for (let y = 0; y < 440; y += 64) fillRect(image, 0, y, 400, 1, '#2c2c3d');
  fillRect(image, 400, 0, 2, 440, '#2c2c3d');

  // Petite horde placée avec un aléatoire fixe, pour juger la lisibilité.
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 34; i++) {
    const x = 20 + random() * 360;
    const y = 220 + random() * 200;
    if (Math.hypot(x - 200, y - 330) > 34) blit(image, sprites.basic, x, y, GAME_SCALE);
  }
  blit(image, sprites.boss, 200, 100, GAME_SCALE);
  blit(image, sprites.player, 200, 330, GAME_SCALE);

  blit(image, sprites.player, 490, 220, ZOOM);
  blit(image, sprites.basic, 660, 220, ZOOM);
  blit(image, sprites.boss, 960, 220, ZOOM);
  writeFileSync(join(previewDir, 'apercu-sprites.png'), encodePng(image));
}
