import { describe, it, expect } from 'vitest';
import { ENGAGE, TIERS } from '@conquista/shared';
import { mkNode, step, type GameState, type Fleet } from './index.js';

/** GameState mínimo com duas bases-âncora (alvos válidos p/ as frotas). */
function makeState(nodes: GameState['nodes']): GameState {
  return {
    nodes,
    fleets: [],
    rng: 7 >>> 0,
    seed: 7,
    time: 0,
    aiTimer: 999, // IA fora do caminho: estes testes isolam a interceptação
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

function fleet(id: number, owner: Fleet['owner'], x: number, y: number, target: number, count: number): Fleet {
  return { id, owner, x, y, target, count };
}

/**
 * Duas bases-âncora perto do campo de briga (~x=500): as frotas de teste ficam
 * DENTRO do alcance de suprimento das suas bases (SUPPLY, F2.5) — estes testes
 * isolam a interceptação, o atrito tem os próprios testes.
 */
function arena(): GameState {
  return makeState([
    mkNode(0, 300, 300, 'you', 0, 10),
    mkNode(1, 720, 300, 'enemy', 0, 10),
  ]);
}

const total = (s: GameState): number =>
  s.nodes.reduce((a, n) => a + n.troops, 0) + s.fleets.reduce((a, f) => a + f.count, 0);

describe('Interceptação em trânsito (F2.5 — ENGAGE)', () => {
  it('frotas inimigas que se cruzam brigam: a menor morre, a maior segue com a diferença', () => {
    const s = arena();
    s.fleets = [fleet(0, 'you', 500, 300, 1, 30), fleet(1, 'enemy', 509, 300, 0, 12)];
    step(s, undefined, 0.01);
    expect(s.fleets.length).toBe(1);
    const survivor = s.fleets[0]!;
    expect(survivor.owner).toBe('you');
    expect(survivor.count).toBeCloseTo(30 - 12, 6);
    expect(s.fx.some((e) => e.kind === 'engage')).toBe(true); // evento visual emitido
  });

  it('forças IGUAIS se aniquilam', () => {
    const s = arena();
    s.fleets = [fleet(0, 'you', 500, 300, 1, 20), fleet(1, 'enemy', 509, 300, 0, 20)];
    step(s, undefined, 0.01);
    expect(s.fleets.length).toBe(0);
  });

  it('mesmo dono NÃO briga (rios aliados se cruzam em paz)', () => {
    const s = arena();
    s.fleets = [fleet(0, 'you', 500, 300, 1, 20), fleet(1, 'you', 505, 300, 1, 20)];
    step(s, undefined, 0.001);
    expect(s.fleets.length).toBe(2);
  });

  it('fora do raio de engajamento, nada acontece', () => {
    const s = arena();
    s.fleets = [
      fleet(0, 'you', 500, 300, 1, 20),
      fleet(1, 'enemy', 500 + ENGAGE.radius + 30, 300, 0, 20),
    ];
    step(s, undefined, 0.0001); // dt minúsculo: não se aproximam o bastante
    expect(s.fleets.length).toBe(2);
    expect(s.fleets[0]!.count).toBe(20);
  });

  it('cadeia no mesmo step é determinística: o grandão atravessa dois piquetes', () => {
    const s = arena();
    s.fleets = [
      fleet(0, 'enemy', 500, 300, 0, 50),
      fleet(1, 'you', 508, 300, 1, 10),
      fleet(2, 'you', 492, 300, 1, 15),
    ];
    step(s, undefined, 0.001);
    expect(s.fleets.length).toBe(1);
    expect(s.fleets[0]!.owner).toBe('enemy');
    expect(s.fleets[0]!.count).toBeCloseTo(50 - 10 - 15, 6);
    expect(s.fx.length).toBe(2); // duas brigas
  });

  it('a briga CONSOME tropas do total (2×menor força) — sink intencional', () => {
    const s = arena();
    s.fleets = [fleet(0, 'you', 500, 300, 1, 30), fleet(1, 'enemy', 509, 300, 0, 12)];
    const before = total(s);
    const dt = 0.001;
    step(s, undefined, dt);
    // As duas bases T1 (you/enemy, abaixo do cap) produzem durante o step — desconta.
    const produced = 2 * TIERS[0]!.prod * dt;
    expect(before + produced - total(s)).toBeCloseTo(2 * 12, 6);
  });

  it('dial ENGAGE.radius = 0 desliga a interceptação (regra antiga)', () => {
    const old = ENGAGE.radius;
    ENGAGE.radius = 0;
    try {
      const s = arena();
      s.fleets = [fleet(0, 'you', 500, 300, 1, 20), fleet(1, 'enemy', 505, 300, 0, 20)];
      step(s, undefined, 0.001);
      expect(s.fleets.length).toBe(2);
    } finally {
      ENGAGE.radius = old;
    }
  });
});
