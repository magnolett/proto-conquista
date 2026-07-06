import { describe, it, expect } from 'vitest';
import { GOLDEN_SCENARIOS, runGolden } from './golden-runner.js';

/**
 * Goldens CONGELADOS: o estado final de cenários canônicos, hasheado e comitado
 * em __goldens__/. Divergiu?
 *  - Mudança INTENCIONAL de regra/dial ⇒ `pnpm goldens:update` e comite o diff.
 *  - Sem mudança intencional ⇒ REGRESSÃO de comportamento (ou não-determinismo
 *    cross-platform: compare o hash local com o do CI). Investigue antes de tocar.
 */
describe('Golden replays congelados (baseline comitada)', () => {
  for (const sc of GOLDEN_SCENARIOS) {
    it(`cenário ${sc.name} bate com a baseline`, async () => {
      const r = runGolden(sc);
      await expect(JSON.stringify(r, null, 2) + '\n').toMatchFileSnapshot(
        `./__goldens__/${sc.name}.json`,
      );
    });
  }
});
