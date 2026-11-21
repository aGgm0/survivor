/* global console, process */
// Copie les icônes utilisées du pack Raven Fantasy Icons (Clockwork Raven) :
// `node tools/ui/copy-raven.mjs <dossier du pack décompressé>`.
// Une icône par arme, mutation et passif, nommée par son id (data/weapons.ts, data/upgrades.ts).
// Licence : fichiers à ne pas redistribuer, version gratuite = jeu gratuit seulement (Premium
// obligatoire pour vendre le jeu). Le dossier de sortie est ignoré par git.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICONS } from './raven-icons.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'public', 'assets', 'ui', 'raven');

const packDir = process.argv[2];
const source = packDir && join(packDir, 'Separated Files', '16x16');
if (!source || !existsSync(source)) {
  console.error('Usage : node tools/ui/copy-raven.mjs <dossier « Free - Raven Fantasy Icons »>');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
for (const [id, n] of Object.entries(ICONS)) {
  copyFileSync(join(source, `fa${n}.png`), join(OUT, `${id}.png`));
}
console.log(`${Object.keys(ICONS).length} icônes copiées dans ${OUT}`);
