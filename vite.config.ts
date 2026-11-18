import { defineConfig } from 'vitest/config';
// Source unique de la version : package.json (changée par `npm version`).
import pkg from './package.json';

export default defineConfig({
  // Chemins relatifs dans le build : le jeu marche quel que soit le dossier où il est servi
  // (itch.io le met dans un sous-dossier qu'on ne connaît pas à l'avance).
  base: './',
  // Remplace `__APP_VERSION__` dans le code par la version (texte), au build comme en dev et en test.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    watch: {
      // Sous Windows, la surveillance par défaut a raté des modifications de fichiers : Vite
      // servait encore l'ancien code. Le polling vérifie les fichiers lui-même (dev seulement).
      usePolling: true,
      interval: 200,
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
