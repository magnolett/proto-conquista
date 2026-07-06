import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Config do BALANCE HARNESS (`pnpm balance`) — separado da suíte normal:
 * roda centenas de partidas self-play e escreve docs/balance-report.md.
 * Não entra no CI nem no `pnpm test` (include distinto: tools/*.sim.ts).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tools/**/*.sim.ts'],
    globals: false,
    testTimeout: 180_000,
  },
  resolve: {
    alias: {
      '@conquista/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
      '@conquista/sim': fileURLToPath(new URL('./packages/sim/src/index.ts', import.meta.url)),
    },
  },
});
