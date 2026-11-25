/* global console, process */
// Importe des effets du pack « Pixel Spells: Inferno » (Odd Jelly Games) dans le jeu :
// `node tools/vfx/import-inferno.mjs`.
// Le pack (tools/vfx/pixel-spells-inferno/, ignoré par git) livre chaque effet en bande d'images
// + JSON Aseprite. Le jeu lit déjà le format des effets PVFX (core/EffectSheet : sprite-sheet.png
// + manifest.json avec la zone visible de chaque image) : plutôt qu'un 2e lecteur dans le jeu, ce
// script convertit une fois. La zone visible est mesurée ici en lisant les pixels du PNG.
// Licence du pack : pas de redistribution des fichiers → le résultat (public/assets/sprites/
// inferno/) est ignoré par git, et ne part que dans le zip itch (le jeu fini, c'est permis).
import { Buffer } from 'node:buffer';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PACK = join(ROOT, 'tools', 'vfx', 'pixel-spells-inferno', 'PixelSpells', 'InfernoSample');
const OUT = join(ROOT, 'public', 'assets', 'sprites', 'inferno');

/** Effets utilisés par le jeu : dossier du pack (couleur/effet) → dossier dans le jeu. */
const EFFECTS = [{ from: 'Fire/FlameNova', to: 'flame-nova' }];

/** Seuil d'opacité (0-255) au-dessus duquel un pixel compte comme visible. */
const ALPHA_MIN = 8;

// ---------------------------------------------------------------- PNG

/**
 * Décode un PNG RGBA 8 bits non entrelacé (le format du pack) en pixels bruts. Pas de
 * dépendance : un PNG = des blocs (« chunks ») ; les données d'image (IDAT) sont compressées
 * en zlib, chaque ligne précédée d'un octet de « filtre » à défaire.
 */
function decodePng(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file} : pas un PNG`);
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const [depth, color, , , interlace] = data.subarray(8, 13);
      if (depth !== 8 || color !== 6 || interlace !== 0) {
        throw new Error(`${file} : seul le RGBA 8 bits non entrelacé est lu`);
      }
    } else if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? pixels[y * stride + x - 4] : 0; // gauche
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0; // dessus
      const c = x >= 4 && y > 0 ? pixels[(y - 1) * stride + x - 4] : 0; // dessus-gauche
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pixels[y * stride + x] = v & 0xff;
    }
  }
  return { width, height, pixels };
}

/** Zone visible d'un rectangle de l'image, en coordonnées du rectangle ; null si vide. */
function visibleBounds(png, fx, fy, fw, fh) {
  let x0 = fw;
  let y0 = fh;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const alpha = png.pixels[((fy + y) * png.width + fx + x) * 4 + 3];
      if (alpha < ALPHA_MIN) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x + 1);
      y1 = Math.max(y1, y + 1);
    }
  }
  return x1 === 0 ? null : [x0, y0, x1, y1];
}

// ---------------------------------------------------------------- conversion

if (!existsSync(PACK)) {
  console.error(`✗ Pack absent : décompresser pixel-spells-inferno-free-sprites.zip dans
  tools/vfx/pixel-spells-inferno/ (on doit trouver ${PACK}).`);
  process.exit(1);
}

for (const { from, to } of EFFECTS) {
  const name = from.split('/').pop();
  const src = join(PACK, from);
  const aseprite = JSON.parse(readFileSync(join(src, `${name}.json`), 'utf8'));
  const png = decodePng(join(src, `${name}.png`));
  const frames = Object.values(aseprite.frames).map((f, i) => {
    const { x, y, w, h } = f.frame;
    return {
      frame: i,
      duration: { numerator_ms: f.duration, denominator: 1 },
      sheet: { x, y, width: w, height: h },
      visible_bounds: visibleBounds(png, x, y, w, h),
    };
  });
  const first = frames[0].sheet;
  // Même format que les exports PVFX (pvfx.fx.export-manifest/1), limité aux champs que lit le jeu.
  const manifest = {
    schema: 'pvfx.fx.export-manifest/1',
    source: `Pixel Spells: Inferno (Free Sample), Odd Jelly Games : ${from}`,
    loop_mode: aseprite.meta.loop ? 'loop' : 'once',
    source_size: [first.width, first.height],
    pivot: [aseprite.meta.pivot.x, aseprite.meta.pivot.y],
    frames,
  };
  const dest = join(OUT, to);
  mkdirSync(dest, { recursive: true });
  copyFileSync(join(src, `${name}.png`), join(dest, 'sprite-sheet.png'));
  writeFileSync(join(dest, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${from} → ${to} : ${frames.length} images`);
  for (const f of frames) {
    const b = f.visible_bounds;
    console.log(
      `  ${String(f.frame).padStart(2)} ${b ? `${b[2] - b[0]}×${b[3] - b[1]} ${b}` : 'vide'}`,
    );
  }
}
