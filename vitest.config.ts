import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Sert aux tests du serveur (src) comme à ceux de l'interface (web/src, jsdom activé fichier par fichier).
export default defineConfig({
  plugins: [react()],
  test: { include: ['src/**/*.test.ts', 'web/src/**/*.test.{ts,tsx}'] },
});
