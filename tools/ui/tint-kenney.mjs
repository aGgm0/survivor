/* global console, process */
// Teinte des cadres blancs du pack Kenney Fantasy UI Borders (CC0) aux couleurs de l'interface :
// `node tools/ui/tint-kenney.mjs <dossier du pack décompressé>`.
// Les cadres teintés sont écrits dans public/assets/ui/kenney/ (CC0 : ils peuvent aller dans git).
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPng, writePng } from './png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'public', 'assets', 'ui', 'kenney');

/** Cadre de sortie → [fichier du pack (PNG/Default/Border/…), couleur] (palette de style.css). */
const FRAMES = {
  'card-weapon': ['panel-border-012.png', '#4f8fd0'], // armes : bleu arcane
  'card-passive': ['panel-border-012.png', '#7fae6a'], // passifs : vert
  'card-heal': ['panel-border-012.png', '#c8324a'], // soin : rouge des PV
  'card-mutation': ['panel-border-026.png', '#dcc47c'], // mutations : or, coins plus riches
};

const packDir = process.argv[2];
const borders = packDir && join(packDir, 'PNG', 'Default', 'Border');
if (!borders || !existsSync(borders)) {
  console.error(
    'Usage : node tools/ui/tint-kenney.mjs <dossier du pack Kenney Fantasy UI Borders>',
  );
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
for (const [name, [file, color]] of Object.entries(FRAMES)) {
  const image = readPng(join(borders, file));
  const n = parseInt(color.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // Les cadres sont blancs : chaque pixel visible prend la couleur, la transparence est gardée.
  for (let i = 0; i < image.data.length; i += 4) {
    const light = image.data[i] / 255;
    image.data[i] = Math.round(rgb[0] * light);
    image.data[i + 1] = Math.round(rgb[1] * light);
    image.data[i + 2] = Math.round(rgb[2] * light);
  }
  writePng(join(OUT, `${name}.png`), image);
  console.log(`${name}.png : ${file} en ${color}`);
}
