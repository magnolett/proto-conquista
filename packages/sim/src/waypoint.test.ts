import { describe, it, expect } from 'vitest';
import { SUPPLY, BASE_KINDS } from '@conquista/shared';
import { mkNode, spawnFleet, step, aiThink, dist, type GameState } from './index.js';

function makeState(nodes: GameState['nodes']): GameState {
  return {
    nodes,
    fleets: [],
    rng: 5 >>> 0,
    seed: 5,
    time: 0,
    aiTimer: 999999,
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

describe('Waypoint (F2.5) — rota é decisão', () => {
  it('a frota visita o desvio ANTES de rumar ao alvo, e a chegada resolve normal', () => {
    const oldAttrition = SUPPLY.attritionPerSec;
    SUPPLY.attritionPerSec = 0; // isola o waypoint (atrito tem teste próprio)
    try {
      const A = mkNode(0, 100, 300, 'you', 0, 50);
      const B = mkNode(1, 900, 300, 'neutral', 0, 5);
      const s = makeState([A, B, mkNode(2, 1200, 100, 'enemy', 0, 1)]);
      spawnFleet(s, A, B, 'you', 20, { x: 500, y: 600 });
      expect(s.fleets[0]!.waypoint).toBeDefined();

      // fase 1: desce rumo ao waypoint (sul), não ao alvo (leste puro)
      let maxY = 300;
      let visited = false;
      for (let i = 0; i < 4000 && s.fleets.length > 0; i++) {
        step(s, undefined, 0.02);
        const f = s.fleets[0];
        if (f) {
          maxY = Math.max(maxY, f.y);
          if (!f.waypoint) visited = true;
        }
      }
      expect(visited).toBe(true); // o waypoint foi alcançado e limpo
      expect(maxY).toBeGreaterThan(550); // realmente desviou ao sul
      expect(s.fleets.length).toBe(0); // e por fim chegou…
      expect(s.nodes[1]!.owner).toBe('you'); // …capturando o alvo
    } finally {
      SUPPLY.attritionPerSec = oldAttrition;
    }
  });

  it('a IA FLANQUEIA canhão hostil: frota de ataque nasce com waypoint fora do alcance', () => {
    const A = mkNode(0, 400, 300, 'you', 1, 20); // único alvo
    const sentry = mkNode(1, 500, 320, 'you', 2, 200, 'cannon'); // guarda a rota
    const atk = mkNode(2, 600, 340, 'enemy', 2, 90);
    const s = makeState([A, sentry, atk]);
    aiThink(s);
    const f = s.fleets.find((x) => x.owner === 'enemy');
    expect(f).toBeDefined();
    expect(f!.target).toBe(A.id);
    expect(f!.waypoint).toBeDefined();
    expect(dist(f!.waypoint!, sentry)).toBeGreaterThanOrEqual(BASE_KINDS.cannon.cannonRange);
  });

  it('rota limpa não ganha waypoint (sem paranoia)', () => {
    const A = mkNode(0, 400, 300, 'you', 1, 20);
    const bystander = mkNode(1, 500, 320, 'you', 2, 200, 'normal');
    const atk = mkNode(2, 600, 340, 'enemy', 2, 90);
    const s = makeState([A, bystander, atk]);
    aiThink(s);
    const f = s.fleets.find((x) => x.owner === 'enemy');
    expect(f).toBeDefined();
    expect(f!.waypoint).toBeUndefined();
  });
});
