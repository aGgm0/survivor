import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Chemins relatifs dans le build : le jeu marche quel que soit le dossier où il est servi
  // (itch.io le met dans un sous-dossier qu'on ne connaît pas à l'avance).
  base: './',
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
