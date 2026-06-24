import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: funciona tanto em dev local quanto num subpath do GitHub Pages.
  base: './',
  server: {
    port: 5173,
    strictPort: false,
  },
  resolve: {
    alias: {
      // Consome os workspaces direto do source TS (sem build prévio).
      // fileURLToPath é cross-platform: URL.pathname dá "/C:/..." inválido no Windows.
      '@conquista/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
      '@conquista/sim': fileURLToPath(new URL('../../packages/sim/src/index.ts', import.meta.url)),
    },
  },
});
