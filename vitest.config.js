import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // Exclut le backend (testé avec Jest) et node_modules
    exclude: ['**/node_modules/**', '**/backend/**', '**/dist/**']
  }
});
