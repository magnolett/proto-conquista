import { describe, it, expect } from 'vitest';
import { NEUTRAL, SUPPLY } from '@conquista/shared';
import { mkNode, step, type GameState, type Fleet } from './index.js';

function makeState(nodes: GameState['nodes']): GameState {
  return {
    nodes,
    fleets: [],
    rng: 9 >>> 0,
    seed: 9,
    time: 0,
    aiTimer: 999999, // IA quieta: os testes isolam economia de mapa e logística
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

/** Mundo mínimo vivo: uma base de cada dono, pobres e afastadas. */
function anchors(): GameState['nodes'] {
  return [mkNode(0, 60, 60, 'you', 0, 1), mkNode(1, 1220, 660, 'enemy', 0, 1)];
}

describe('Neutras crescem (F2.5 — NEUTRAL)', () => {
  it('neutra fraca engorda com o tempo e PARA no teto min(cap, growthCap)', () => {
    const neutral = mkNode(2, 640, 360, 'neutral', 0, 5); // cap T1 = 30
    const s = makeState([...anchors(), neutral]);
    for (let i = 0; i < 200; i++) step(s, undefined, 0.5); // 100 s
    expect(neutral.troops).toBeGreaterThan(5); // esperar custou ao invasor
    for (let i = 0; i < 800; i++) step(s, undefined, 0.5); // mais 400 s: satura
    expect(neutral.troops).toBeCloseTo(Math.min(30, NEUTRAL.growthCap), 6);
  });

  it('neutra já no teto (ou acima) fica parada', () => {
    const fat = mkNode(2, 640, 360, 'neutral', 2, NEUTRAL.growthCap + 5);
    const s = makeState([...anchors(), fat]);
    for (let i = 0; i < 100; i++) step(s, undefined, 0.5);
    expect(fat.troops).toBe(NEUTRAL.growthCap + 5);
  });

  it('dial growthRate 0 ⇒ neutras estáticas (regra antiga)', () => {
    const old = NEUTRAL.growthRate;
    NEUTRAL.growthRate = 0;
    try {
      const neutral = mkNode(2, 640, 360, 'neutral', 0, 5);
      const s = makeState([...anchors(), neutral]);
      for (let i = 0; i < 100; i++) step(s, undefined, 0.5);
      expect(neutral.troops).toBe(5);
    } finally {
      NEUTRAL.growthRate = old;
    }
  });
});

describe('Atrito de suprimento (F2.5 — SUPPLY)', () => {
  const farFleet = (owner: Fleet['owner'], count: number): Fleet =>
    // longe de QUALQUER base do dono (âncoras nos cantos opostos)
    ({ id: 0, owner, x: 640, y: 360, target: 1, count });

  it('frota além do alcance da própria logística definha', () => {
    const s = makeState(anchors());
    s.fleets = [farFleet('you', 20)];
    step(s, undefined, 1);
    const f = s.fleets[0]!;
    expect(f.count).toBeLessThan(20);
    expect(f.count).toBeCloseTo(20 - 20 * SUPPLY.attritionPerSec * 1, 3);
  });

  it('frota perto de base própria NÃO sofre', () => {
    const s = makeState(anchors());
    s.fleets = [{ id: 0, owner: 'you', x: 100, y: 100, target: 1, count: 20 }];
    step(s, undefined, 0.5);
    expect(s.fleets[0]!.count).toBe(20);
  });

  it('frota faminta abaixo de 1 tropa morre', () => {
    const s = makeState(anchors());
    s.fleets = [farFleet('you', 1.01)];
    step(s, undefined, 1);
    expect(s.fleets.length).toBe(0);
  });

  it('frota NEUTRA é imune (não há logística neutra)', () => {
    const s = makeState(anchors());
    s.fleets = [farFleet('neutral', 20)];
    step(s, undefined, 1);
    expect(s.fleets[0]!.count).toBe(20);
  });

  it('dial attritionPerSec 0 desliga o atrito', () => {
    const old = SUPPLY.attritionPerSec;
    SUPPLY.attritionPerSec = 0;
    try {
      const s = makeState(anchors());
      s.fleets = [farFleet('you', 20)];
      step(s, undefined, 1);
      expect(s.fleets[0]!.count).toBe(20);
    } finally {
      SUPPLY.attritionPerSec = old;
    }
  });
});
