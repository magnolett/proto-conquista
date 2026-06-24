import { describe, it, expect } from 'vitest';
import { createInitialState, mkNode, computeScore } from './index.js';
import { SCORE } from '@conquista/shared';

describe('Placar — computeScore (puro)', () => {
  it('soma bases, tropas e tiers ponderados; conta frotas em trânsito', () => {
    const s = createInitialState(1);
    s.nodes = [
      mkNode(0, 0, 0, 'you', 2, 10, 'normal'), // tier 2
      mkNode(1, 0, 0, 'you', 0, 5, 'normal'), // tier 0
      mkNode(2, 0, 0, 'enemy', 1, 99, 'normal'),
    ];
    s.fleets = [{ id: 0, owner: 'you', x: 0, y: 0, target: 2, count: 7 }];
    // você: 2 bases + tropas (10+5+7=22) + tiers (2+0=2)
    expect(computeScore(s, 'you')).toBe(2 * SCORE.baseW + 22 + 2 * SCORE.tierW);
    // inimigo: 1 base + 99 tropas + tier 1
    expect(computeScore(s, 'enemy')).toBe(1 * SCORE.baseW + 99 + 1 * SCORE.tierW);
  });

  it('mais bases/tropas/tier ⇒ score maior', () => {
    const s = createInitialState(1);
    s.nodes = [
      mkNode(0, 0, 0, 'you', 1, 20, 'normal'),
      mkNode(1, 0, 0, 'enemy', 0, 5, 'normal'),
    ];
    s.fleets = [];
    expect(computeScore(s, 'you')).toBeGreaterThan(computeScore(s, 'enemy'));
  });

  it('lado sem nada pontua 0', () => {
    const s = createInitialState(1);
    s.nodes = [mkNode(0, 0, 0, 'you', 0, 10, 'normal')];
    s.fleets = [];
    expect(computeScore(s, 'enemy')).toBe(0);
  });
});
