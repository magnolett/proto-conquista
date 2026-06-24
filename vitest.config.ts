import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // A sim é pura: ambiente node, sem DOM.
    environment: 'node',
    include: ['packages/**/*.test.ts'],
    // Garante reprodutibilidade: nenhum teste depende de wall-clock real.
    globals: false,
  },
  resolve: {
    alias: {
      // Resolve os workspaces direto do source TS (sem build prévio).
      // fileURLToPath é cross-platform: URL.pathname dá "/C:/..." inválido no Windows.
      '@conquista/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
      '@conquista/sim': fileURLToPath(new URL('./packages/sim/src/index.ts', import.meta.url)),
    },
  },
});
