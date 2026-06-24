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
      '@conquista/shared': new URL('./packages/shared/src/index.ts', import.meta.url).pathname,
      '@conquista/sim': new URL('./packages/sim/src/index.ts', import.meta.url).pathname,
    },
  },
});
