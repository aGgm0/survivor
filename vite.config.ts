import { defineConfig } from 'vitest/config';

export default defineConfig({
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
