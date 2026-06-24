import { describe, it, expect } from 'vitest';
import { createInitialState, step, cloneState, type GameState, type Inputs } from './index.js';
import type { Difficulty } from '@conquista/shared';

/**
 * Roteiro FIXO de inputs do jogador, indexado por número do step.
 * Determinístico por construção — nenhuma fonte de acaso aqui.
 */
function scriptedInputs(stepIndex: number): Inputs {
  // No step 20, envia 50% das bases 0..3 p/ a base 2 (centro).
  if (stepIndex === 20) {
    return { sends: [{ sourceIds: [0, 1, 3], targetId: 2, ratio: 0.5 }] };
  }
  // No step 60, tenta upgrade da base do jogador (id 0).
  if (stepIndex === 60) {
    return { upgrades: [{ nodeId: 0 }] };
  }
  // No step 90, multi-envio p/ uma neutra qualquer.
  if (stepIndex === 90) {
    return { sends: [{ sourceIds: [0], targetId: 5, ratio: 0.75 }] };
  }
  return {};
}

/** Roda uma partida completa (N steps) e devolve o estado final (clonado). */
function runReplay(seed: number, difficulty: Difficulty, steps: number, dt: number): GameState {
  const s = createInitialState(seed, { difficulty });
  for (let i = 0; i < steps; i++) {
    step(s, scriptedInputs(i), dt);
  }
  return cloneState(s);
}

describe('Golden replay (determinismo)', () => {
  const SEED = 0xc0ffee;
  const STEPS = 400;
  const DT = 1 / 60;

  it('mesma seed + mesmos inputs ⇒ GameState final IDÊNTICO entre execuções', () => {
    const a = runReplay(SEED, 'normal', STEPS, DT);
    const b = runReplay(SEED, 'normal', STEPS, DT);
    // Igualdade estrutural profunda: nodes, fleets, rng, time, winner, tudo.
    expect(b).toStrictEqual(a);
    // E o serializado bate byte-a-byte (snapshot determinístico).
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('o replay realmente EXERCITA a sim (IA cria frotas, estado do PRNG avança)', () => {
    const s = createInitialState(SEED, { difficulty: 'hard' });
    const rng0 = s.rng;
    let sawFleet = false;
    for (let i = 0; i < 120; i++) {
      step(s, scriptedInputs(i), DT);
      if (s.fleets.length > 0) sawFleet = true;
    }
    expect(sawFleet).toBe(true); // houve movimento
    expect(s.rng).not.toBe(rng0); // o PRNG avançou (IA sacou valores)
    expect(s.time).toBeCloseTo(120 * DT, 6);
  });

  it('seeds diferentes ⇒ mapas diferentes (o seed importa)', () => {
    const a = createInitialState(1, { difficulty: 'normal' });
    const b = createInitialState(2, { difficulty: 'normal' });
    const posA = a.nodes.map((n) => `${n.x.toFixed(4)},${n.y.toFixed(4)}`).join('|');
    const posB = b.nodes.map((n) => `${n.x.toFixed(4)},${n.y.toFixed(4)}`).join('|');
    expect(posA).not.toBe(posB);
  });

  it('snapshot inline do estado final (trava regressão de determinismo)', () => {
    const s = runReplay(SEED, 'normal', 200, DT);
    // Resumo compacto e estável do estado final.
    const summary = {
      rng: s.rng,
      time: Number(s.time.toFixed(6)),
      gameOver: s.gameOver,
      winner: s.winner,
      nodeCount: s.nodes.length,
      fleetCount: s.fleets.length,
      ownerTroops: {
        you: Math.round(s.nodes.filter((n) => n.owner === 'you').reduce((a, n) => a + n.troops, 0)),
        enemy: Math.round(
          s.nodes.filter((n) => n.owner === 'enemy').reduce((a, n) => a + n.troops, 0),
        ),
        neutral: s.nodes.filter((n) => n.owner === 'neutral').length,
      },
    };
    // Não fixamos números mágicos a olho: garantimos apenas que o snapshot é
    // ESTÁVEL rodando duas vezes. (Se quiser congelar, troque por toMatchSnapshot.)
    const again = runReplay(SEED, 'normal', 200, DT);
    const summary2 = {
      rng: again.rng,
      time: Number(again.time.toFixed(6)),
      gameOver: again.gameOver,
      winner: again.winner,
      nodeCount: again.nodes.length,
      fleetCount: again.fleets.length,
      ownerTroops: {
        you: Math.round(
          again.nodes.filter((n) => n.owner === 'you').reduce((a, n) => a + n.troops, 0),
        ),
        enemy: Math.round(
          again.nodes.filter((n) => n.owner === 'enemy').reduce((a, n) => a + n.troops, 0),
        ),
        neutral: again.nodes.filter((n) => n.owner === 'neutral').length,
      },
    };
    expect(summary2).toStrictEqual(summary);
  });
});
