import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: false,
  },
  resolve: {
    alias: {
      // Consome os workspaces direto do source TS (sem build prévio).
      '@conquista/shared': new URL('../../packages/shared/src/index.ts', import.meta.url).pathname,
      '@conquista/sim': new URL('../../packages/sim/src/index.ts', import.meta.url).pathname,
    },
  },
});
