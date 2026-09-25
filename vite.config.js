import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Chemins relatifs : le même build sert GitHub Pages (sous-dossier) et l'application Mac (Tauri).
export default defineConfig({
  base: './',
  plugins: [react()],
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', target: 'es2020' },
});
