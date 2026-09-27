import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // Pool « threads » : sur Windows, le pool « forks » par défaut peut dépasser
    // le délai d'attente au démarrage des workers (« Timeout waiting for worker
    // to respond ») et faire échouer TOUS les tests. Le pool threads démarre
    // de façon fiable dans cet environnement.
    pool: 'threads',
    // Exclut le backend (testé avec Jest) et node_modules
    exclude: ['**/node_modules/**', '**/backend/**', '**/dist/**']
  }
});
