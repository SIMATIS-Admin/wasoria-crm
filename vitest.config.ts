import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Sert aux tests du serveur (src) comme à ceux de l'interface (web/src, jsdom activé fichier par fichier).
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'web/src/**/*.test.{ts,tsx}'],
    // Chaque fichier qui touche la base démarre son propre Postgres : en limiter le nombre en parallèle
    // évite les démarrages qui traînent quand la machine est chargée.
    maxWorkers: 4,
    hookTimeout: 120_000,
  },
});
