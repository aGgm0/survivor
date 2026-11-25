/* global console, process */
// Prépare le jeu pour itch.io : `npm run release:itch` (build, puis ce script).
// Résultat : release/survivor-<version>-itch.zip, à envoyer sur itch.io comme jeu HTML5.
// Pourquoi un script : Vite copie tout public/ dans le build, y compris les fichiers d'origine des
// packs dont la licence interdit de redistribuer les fichiers (Dark Ages UI : la planche complète).
// Le jeu n'a besoin que des morceaux découpés ; on retire le reste avant de faire le zip.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = join(ROOT, 'dist');
const OUT_DIR = join(ROOT, 'release');
// Version dans le nom du zip : on sait toujours quelle version est envoyée sur itch.
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const ZIP = join(OUT_DIR, `survivor-${version}-itch.zip`);

/** Fichiers du build à ne jamais publier (chemins relatifs à dist/). */
const EXCLUDED = [
  'assets/ui/darkages/32x32-Tilesheet.png', // planche complète du pack
  'assets/ui/darkages/LICENSE.txt', // licence du pack (le crédit est dans LICENSES.md)
];

/**
 * Sans ces fichiers, le jeu s'afficherait en formes de secours : on refuse de faire un zip
 * incomplet (pack pas copié sur cette machine, voir public/assets/LICENSES.md).
 */
const REQUIRED = [
  'index.html',
  'assets/ui/darkages/panel.png',
  'assets/ui/raven/sword.png',
  'assets/sprites/inferno/flame-nova/sprite-sheet.png', // node tools/vfx/import-inferno.mjs
];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!existsSync(DIST))
  fail('dist/ absent : lancer `npm run build` avant (ou `npm run release:itch`).');
for (const file of REQUIRED) {
  if (!existsSync(join(DIST, file))) fail(`${file} manque dans le build : pack non installé ?`);
}

for (const file of EXCLUDED) rmSync(join(DIST, file), { force: true });

// Outils de dev : ne doivent jamais partir (le menu F2 est déjà retiré par Vite).
function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [relative(DIST, path)];
  });
}
const files = listFiles(DIST);
const leaked = files.filter((f) => /tools|preview\.html|\.wav\.asd/.test(f));
if (leaked.length > 0) fail(`fichiers de dev dans le build : ${leaked.join(', ')}`);

// Zip avec le tar de Windows (bsdtar, sait écrire des .zip avec des « / » que tous les serveurs
// lisent ; Compress-Archive de PowerShell 5 peut écrire des « \ »).
mkdirSync(OUT_DIR, { recursive: true });
rmSync(ZIP, { force: true });
const windowsTar = 'C:\\Windows\\System32\\tar.exe';
const tar = existsSync(windowsTar) ? windowsTar : 'tar';
// Le contenu de dist/ (et pas « . ») : index.html doit être à la racine du zip, sans « ./ » devant.
const result = spawnSync(tar, ['-a', '-c', '-f', ZIP, '-C', DIST, ...readdirSync(DIST)], {
  stdio: 'inherit',
});
if (result.status !== 0) fail('création du zip impossible');

const size = (statSync(ZIP).size / 1024 / 1024).toFixed(1);
console.log(`✓ ${files.length} fichiers → ${relative(ROOT, ZIP)} (${size} Mo)`);
