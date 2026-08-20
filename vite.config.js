import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://annorfrancis.github.io/yvonnes-collections/
export default defineConfig({
  base: '/yvonnes-collections/',
  plugins: [react()],
  server: { port: 5199 },
});
