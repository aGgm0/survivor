/* global console, process */
// Découpe la planche du pack Dark Ages UI (Hypnobius) en un fichier par élément :
// `node tools/ui/slice-darkages.mjs`. CSS ne sait pas prendre un morceau d'une grande image
// comme cadre (`border-image`), il faut une image par cadre.
// Licence du pack : fichiers à ne pas redistribuer. Planche et découpes restent dans
// public/assets/ui/darkages/, ignoré par git (voir .gitignore).
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crop, readPng, writePng } from './png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = join(ROOT, 'public', 'assets', 'ui', 'darkages');
const SHEET = join(DIR, '32x32-Tilesheet.png');

/** Éléments à découper : nom → [x, y, largeur, hauteur] dans la planche (mesurés aux pixels près). */
const PIECES = {
  panel: [0, 0, 96, 96], // grand cadre doré orné
  'panel-dark': [210, 18, 60, 60], // panneau sombre, bordure tressée
  button: [0, 104, 64, 19],
  'button-hover': [64, 104, 64, 19],
  slot: [194, 101, 28, 27],
  'bar-frame': [197, 137, 86, 13], // cadre doré des barres
  'bar-red': [199, 176, 82, 4],
  'bar-blue': [296, 144, 82, 4],
  'bar-green': [295, 176, 82, 4],
  divider: [297, 270, 37, 6],
  'bar-body': [197, 141, 86, 9], // corps du cadre de barre, sans l'ornement du dessus
  plate: [288, 106, 32, 15], // petite plaque sombre (timer)
  'plate-crown': [352, 98, 32, 23], // plaque à couronne dorée (niveau)
};

// ---------------------------------------------------------------- découpe

if (!existsSync(SHEET)) {
  console.error(
    `Planche introuvable : ${SHEET}\nCopie 32x32-Tilesheet.png du pack Dark Ages UI dans ce dossier.`,
  );
  process.exit(1);
}
const sheet = readPng(SHEET);
for (const [name, rect] of Object.entries(PIECES)) {
  writePng(join(DIR, `${name}.png`), crop(sheet, rect));
  console.log(`${name}.png : ${rect[2]} × ${rect[3]} px`);
}
