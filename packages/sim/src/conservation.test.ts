import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { NEUTRAL } from '@conquista/shared';
import { createInitialState, step, cloneState, type GameState } from './index.js';

/** Soma de TODAS as tropas no estado: bases + frotas em trânsito. */
function totalTroops(s: GameState): number {
  let t = 0;
  for (const n of s.nodes) t += n.troops;
  for (const f of s.fleets) t += f.count;
  return t;
}

describe('Conservação de tropas', () => {
  it('pré-condição F2.5: growthCap não pode invalidar os cenários abaixo', () => {
    // Os cenários usam guarnições neutras de 40/50 tropas e DEPENDEM de neutras
    // não produzirem: o crescimento de neutras (NEUTRAL) só age ABAIXO do teto.
    // Se este guard falhar, suba as guarnições dos testes junto com o dial.
    expect(NEUTRAL.growthCap).toBeLessThanOrEqual(40);
  });

  it('um step sem combate, sem produção e sem IA conserva o total', () => {
    // Estado artificial: só bases NEUTRAS (não produzem) + uma frota longe do alvo.
    const s = createInitialState(1, { difficulty: 'normal' });
    // Neutraliza tudo p/ zerar produção e desligar a IA (nenhuma base 'enemy').
    for (const n of s.nodes) {
      n.owner = 'neutral';
      n.troops = 50;
    }
    // Frota neutra a meio caminho entre dois nós distantes, com dt pequeno p/ não chegar.
    const a = s.nodes[0]!;
    const b = s.nodes[1]!;
    s.fleets.push({
      id: s.nextFleetId++,
      owner: 'neutral',
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      target: b.id,
      count: 17,
    });

    const before = totalTroops(s);
    step(s, undefined, 0.001); // dt minúsculo: a frota se move mas NÃO chega.
    const after = totalTroops(s);

    expect(s.fleets.length).toBe(1); // não chegou
    expect(after).toBeCloseTo(before, 9);
  });

  it('property: mapa todo neutro (sem produção, sem IA) + frota a meio caminho ⇒ total conservado', () => {
    // A conservação só vale SEM combate, SEM produção e SEM upgrade. Upgrade da IA
    // e captura são SINKS legítimos de tropa (consomem/destroem), então os isolamos:
    // neutralizar todos os donos zera a produção E faz a IA retornar cedo (sem 'enemy').
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.double({ min: 0.0005, max: 0.003, noNaN: true }),
        (seed, dt) => {
          const s = createInitialState(seed, { difficulty: 'normal' });
          for (const n of s.nodes) {
            n.owner = 'neutral';
            n.troops = 40;
          }
          const a = s.nodes[0]!;
          const b = s.nodes[1]!;
          s.fleets.push({
            id: s.nextFleetId++,
            owner: 'neutral',
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            target: b.id,
            count: 23,
          });
          const before = totalTroops(s);
          const clone = cloneState(s);
          step(clone, undefined, dt);
          const after = totalTroops(clone);
          return Math.abs(after - before) < 1e-6;
        },
      ),
      { numRuns: 200 },
    );
  });
});
