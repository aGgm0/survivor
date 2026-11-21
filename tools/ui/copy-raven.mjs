/* global console, process */
// Copie les icônes utilisées du pack Raven Fantasy Icons (Clockwork Raven) :
// `node tools/ui/copy-raven.mjs <dossier du pack décompressé>`.
// Une icône par arme, mutation et passif, nommée par son id (data/weapons.ts, data/upgrades.ts).
// Licence : fichiers à ne pas redistribuer, version gratuite = jeu gratuit seulement (Premium
// obligatoire pour vendre le jeu). Le dossier de sortie est ignoré par git.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'public', 'assets', 'ui', 'raven');

/** id dans le jeu → numéro de l'icône dans le pack (fichiers `faN.png`, en 16 × 16). */
const ICONS = {
  // Armes
  arcaneBolt: 783, // comète bleue
  burningAura: 758, // spirale de feu
  runicOrbs: 776, // cercle runique violet
  sword: 156, // épée bleue
  // Mutations
  piercingBolt: 1010, // lance de glace
  burstBolt: 774, // éclat violet
  furnace: 767, // explosion de feu (ex-Brasier)
  frostAura: 787, // flocon de glace qui rayonne
  giantOrbs: 773, // anneau violet
  orbStorm: 786, // tourbillon bleu
  whirlwind: 725, // coup en tourbillon
  thrust: 728, // épée pointée qui scintille (coup d'estoc)
  // Passifs
  vitality: 659, // cœur
  swiftness: 667, // botte ailée
  attraction: 118, // aimant
  power: 657, // bras musclé
  haste: 1025, // éclair
  impact: 1044, // marteau doré
  size: 865, // flèche vers le haut
  velocity: 1018, // trait rapide
  duplicator: 969, // éclats en double
};

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
