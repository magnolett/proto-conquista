import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createInitialState, step, mkNode, resolveArrival } from './index.js';
import type { Fleet } from './index.js';

function fleet(owner: Fleet['owner'], target: number, count: number): Fleet {
  return { id: 0, owner, x: 0, y: 0, target, count };
}

describe('Regra de captura (resolveArrival)', () => {
  it('chega com MAIS que a defesa ⇒ base vira do atacante com o excedente', () => {
    const tn = mkNode(0, 0, 0, 'enemy', 0, 10);
    resolveArrival(fleet('you', 0, 15), tn); // 15 vs 10
    expect(tn.owner).toBe('you');
    expect(tn.troops).toBe(5); // excedente = 15 - 10
  });

  it('chega com MENOS que a defesa ⇒ defesa diminui, dono mantém', () => {
    const tn = mkNode(0, 0, 0, 'enemy', 0, 10);
    resolveArrival(fleet('you', 0, 4), tn); // 4 vs 10
    expect(tn.owner).toBe('enemy');
    expect(tn.troops).toBe(6); // 10 - 4
  });

  it('chega EMPATADO com a defesa ⇒ não vira (troops = 0, dono mantém)', () => {
    // game.js: vira só se troops < 0; empate deixa em 0 com o dono original.
    const tn = mkNode(0, 0, 0, 'enemy', 0, 10);
    resolveArrival(fleet('you', 0, 10), tn);
    expect(tn.owner).toBe('enemy');
    expect(tn.troops).toBe(0);
  });

  it('mesma cor ⇒ reforço soma (pode passar do cap)', () => {
    const tn = mkNode(0, 0, 0, 'you', 0, 25); // cap T1 = 30
    resolveArrival(fleet('you', 0, 20), tn);
    expect(tn.owner).toBe('you');
    expect(tn.troops).toBe(45); // reforço ultrapassa o cap
  });

  it('property: captura ⇔ count > defesa; e novo total = |count - defesa|', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 1, max: 200 }),
        (defense, attack) => {
          const tn = mkNode(0, 0, 0, 'enemy', 0, defense);
          resolveArrival(fleet('you', 0, attack), tn);
          if (attack > defense) {
            return tn.owner === 'you' && tn.troops === attack - defense;
          }
          return tn.owner === 'enemy' && tn.troops === defense - attack;
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe('Captura via step (integração)', () => {
  it('uma frota do jogador captura uma base neutra fraca ao chegar', () => {
    const s = createInitialState(99, { difficulty: 'normal' });
    // Escolhe uma base neutra e posiciona uma frota colada nela com força suficiente.
    const target = s.nodes.find((n) => n.owner === 'neutral')!;
    target.troops = 5;
    s.fleets.push({
      id: s.nextFleetId++,
      owner: 'you',
      // bem perto p/ chegar no próximo step (dentro de stepLen + radius*0.4)
      x: target.x - 1,
      y: target.y,
      target: target.id,
      count: 12,
    });
    step(s, undefined, 0.05);
    const after = s.nodes[target.id]!;
    expect(after.owner).toBe('you');
    expect(after.troops).toBeGreaterThan(0);
    // a frota foi consumida na chegada
    expect(s.fleets.some((f) => f.target === target.id && f.owner === 'you' && f.count === 12)).toBe(
      false,
    );
  });
});
