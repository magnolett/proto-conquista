import { describe, it, expect } from 'vitest';
import { CORE } from '@conquista/shared';
import { createInitialState, step, mkNode, type GameState } from './index.js';

/** Arena mínima: fortaleza central + base inimiga pobre (mantém a partida viva). */
function makeState(coreOwner: GameState['nodes'][number]['owner']): GameState {
  const core = mkNode(0, 640, 360, coreOwner, 2, 100, 'shield');
  core.isCore = true;
  const poorEnemy = mkNode(1, 1200, 650, 'enemy', 0, 1);
  const poorYou = mkNode(2, 100, 100, 'you', 0, 1);
  return {
    nodes: [core, poorEnemy, poorYou],
    fleets: [],
    rng: 42 >>> 0,
    seed: 42,
    time: 0,
    aiTimer: 999999, // IA quieta: o teste isola a regra de domínio
    difficulty: 'normal',
    persona: 'balanced',
    gameOver: false,
    winner: null,
    nextFleetId: 0,
    config: { fleetSpeed: 135, sendDefault: 0.5, worldW: 1280, worldH: 720 },
    fx: [],
    coreHold: { owner: null, held: 0 },
    winReason: null,
  };
}

describe('Vitória por DOMÍNIO do centro (F2.5 — CORE)', () => {
  it('segurar a fortaleza por holdSeconds contínuos vence, com winReason "core"', () => {
    const s = makeState('you');
    for (let i = 0; i < Math.ceil(CORE.holdSeconds / 0.5) + 4 && !s.gameOver; i++) {
      step(s, undefined, 0.5);
    }
    expect(s.gameOver).toBe(true);
    expect(s.winner).toBe('you');
    expect(s.winReason).toBe('core');
    expect(s.time).toBeGreaterThanOrEqual(CORE.holdSeconds - 0.6);
  });

  it('trocar de mãos REINICIA a contagem; centro neutro zera', () => {
    const s = makeState('you');
    for (let i = 0; i < 20; i++) step(s, undefined, 0.5); // ~10s de domínio seu
    expect(s.coreHold.owner).toBe('you');
    expect(s.coreHold.held).toBeGreaterThan(9);

    s.nodes[0]!.owner = 'enemy'; // a IA toma o centro
    step(s, undefined, 0.5);
    expect(s.coreHold.owner).toBe('enemy');
    expect(s.coreHold.held).toBeLessThan(1); // recomeçou

    s.nodes[0]!.owner = 'neutral'; // centro devolvido ao mapa
    step(s, undefined, 0.5);
    expect(s.coreHold.owner).toBeNull();
    expect(s.coreHold.held).toBe(0);
  });

  it('dial holdSeconds = 0 desliga o domínio (vitória só por eliminação)', () => {
    const old = CORE.holdSeconds;
    CORE.holdSeconds = 0;
    try {
      const s = makeState('you');
      for (let i = 0; i < 40; i++) step(s, undefined, 0.5);
      expect(s.gameOver).toBe(false);
      expect(s.coreHold.owner).toBeNull();
    } finally {
      CORE.holdSeconds = old;
    }
  });

  it('o mapgen marca exatamente UMA fortaleza central como core', () => {
    const s = createInitialState(0xc0ffee, { difficulty: 'normal' });
    const cores = s.nodes.filter((n) => n.isCore);
    expect(cores.length).toBe(1);
    expect(cores[0]!.kind).toBe('shield'); // a fortaleza central escudo
    expect(cores[0]!.tier).toBe(2);
  });
});
