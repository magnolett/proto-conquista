import { describe, it, expect } from 'vitest';
import { createInitialState, step } from './index.js';

/**
 * Smoke de partida inteira (anti-stall): contra um jogador PASSIVO, a IA precisa
 * saber FECHAR o jogo em tempo finito — por eliminação ou por domínio do centro.
 * Se este teste travar em timeout ou falhar, a IA perdeu a capacidade de vencer
 * (regressão de gameplay, não de código).
 */
describe('Partida completa (smoke determinístico)', () => {
  it('IA hard fecha o jogo contra jogador passivo em < 10 min de sim', () => {
    const seeds = [0xc0ffee, 7, 42];
    for (const seed of seeds) {
      const s = createInitialState(seed, { difficulty: 'hard' });
      const maxSteps = 10 * 60 * 60; // 10 min simulados a 60 Hz
      for (let i = 0; i < maxSteps && !s.gameOver; i++) {
        step(s, undefined, 1 / 60);
      }
      expect(s.gameOver).toBe(true);
      expect(s.winner).toBe('enemy'); // jogador parado deve perder
      expect(s.winReason).not.toBeNull();
    }
  });

  it('duas execuções da MESMA partida completa terminam idênticas (determinismo ponta a ponta)', () => {
    const run = (): string => {
      const s = createInitialState(0xbada55, { difficulty: 'normal' });
      for (let i = 0; i < 20000 && !s.gameOver; i++) step(s, undefined, 1 / 60);
      return JSON.stringify({
        time: s.time.toFixed(4),
        winner: s.winner,
        winReason: s.winReason,
        persona: s.persona,
        rng: s.rng,
        nodes: s.nodes.map((n) => [n.owner, Math.round(n.troops), n.tier, n.kind]),
      });
    };
    expect(run()).toBe(run());
  });
});
