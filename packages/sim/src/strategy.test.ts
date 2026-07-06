import { describe, it, expect } from 'vitest';
import { ROUTE, DOCTRINES, TIERS } from '@conquista/shared';
import {
  createInitialState,
  step,
  aiThink,
  mkNode,
  type GameState,
  type Fleet,
} from './index.js';

/** GameState mínimo (IA quieta; âncoras evitam atrito/fim de jogo espúrios). */
function makeState(nodes: GameState['nodes']): GameState {
  return {
    nodes,
    fleets: [],
    rng: 11 >>> 0,
    seed: 11,
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
    doctrines: {
      you: { id: 'blitz', activeLeft: 0, cooldownLeft: 0 },
      enemy: { id: 'blitz', activeLeft: 0, cooldownLeft: 0 },
    },
    layout: 'classic',
  };
}

describe('Rotas de suprimento (F4-lite — ROUTE)', () => {
  // destino LONGE: a 1ª frota da rota ainda está em voo quando o teste verifica
  const arena = (): GameState =>
    makeState([
      mkNode(0, 300, 300, 'you', 1, 50),
      mkNode(1, 1100, 300, 'you', 0, 5),
      mkNode(2, 1200, 650, 'enemy', 0, 1),
    ]);

  it('liga a rota e despacha o excedente imediatamente (e depois por intervalo)', () => {
    const s = arena();
    step(s, { routes: [{ fromId: 0, toId: 1 }] }, 0.01);
    const first = Math.floor((50 - ROUTE.keep) * ROUTE.ratio);
    const f = s.fleets.find((x) => x.owner === 'you');
    expect(f).toBeDefined();
    expect(f!.target).toBe(1);
    expect(f!.count).toBe(first); // 1º despacho é imediato (feedback na hora)
    // dentro do intervalo NÃO despacha de novo
    step(s, undefined, ROUTE.interval * 0.5);
    expect(s.fleets.filter((x) => x.owner === 'you').length).toBe(1);
  });

  it('rota morre quando o destino troca de dono (nunca abastece o inimigo)', () => {
    const s = arena();
    step(s, { routes: [{ fromId: 0, toId: 1 }] }, 0.01);
    s.nodes[1]!.owner = 'enemy'; // destino cai
    step(s, undefined, ROUTE.interval + 0.1);
    expect(s.nodes[0]!.routeTo).toBeUndefined();
  });

  it('toId null REMOVE a rota; base alheia é ignorada', () => {
    const s = arena();
    step(s, { routes: [{ fromId: 0, toId: 1 }] }, 0.01);
    expect(s.nodes[0]!.routeTo).toBe(1);
    step(s, { routes: [{ fromId: 0, toId: null }] }, 0.01);
    expect(s.nodes[0]!.routeTo).toBeUndefined();
    step(s, { routes: [{ fromId: 2, toId: 1 }] }, 0.01); // nó da IA: input inválido
    expect(s.nodes[2]!.routeTo).toBeUndefined();
  });

  it('obra pausa o fluxo (a base em evolução guarda o que tem)', () => {
    const s = arena();
    step(s, { routes: [{ fromId: 0, toId: 1 }], upgrades: [{ nodeId: 0 }] }, 0.01);
    // upgrade consumiu 40 (T2), a base entrou em obra: nenhuma frota de rota sai
    expect(s.nodes[0]!.upgrading).toBeDefined();
    const before = s.fleets.length;
    step(s, undefined, ROUTE.interval + 0.1);
    expect(s.fleets.length).toBe(before);
  });
});

describe('Doutrinas (F4-lite — DOCTRINES)', () => {
  it('ativa via input, respeita duração e cooldown', () => {
    const s = makeState([mkNode(0, 300, 300, 'you', 0, 10), mkNode(1, 900, 300, 'enemy', 0, 1)]);
    s.doctrines.you.id = 'surge';
    step(s, { doctrine: true }, 0.01);
    expect(s.doctrines.you.activeLeft).toBeGreaterThan(0);
    const cdAfterActivation = s.doctrines.you.cooldownLeft;
    expect(cdAfterActivation).toBeGreaterThan(DOCTRINES.surge.cooldown - 1);
    step(s, { doctrine: true }, 0.01); // re-pedido durante o efeito: ignorado
    expect(s.doctrines.you.cooldownLeft).toBeLessThanOrEqual(cdAfterActivation);
  });

  it('Mobilização multiplica a produção do lado enquanto ativa', () => {
    const run = (activate: boolean): number => {
      const s = makeState([mkNode(0, 300, 300, 'you', 0, 10), mkNode(1, 900, 300, 'enemy', 0, 1)]);
      s.doctrines.you.id = 'surge';
      step(s, activate ? { doctrine: true } : undefined, 1);
      return s.nodes[0]!.troops;
    };
    const boosted = run(true);
    const plain = run(false);
    expect(boosted).toBeGreaterThan(plain);
    expect(boosted - 10).toBeCloseTo((plain - 10) * DOCTRINES.surge.prodMul, 3);
  });

  it('Blitz acelera as frotas do dono (e só as dele)', () => {
    const s = makeState([mkNode(0, 100, 300, 'you', 0, 10), mkNode(1, 1200, 300, 'enemy', 0, 1)]);
    s.doctrines.you.id = 'blitz';
    const mine: Fleet = { id: 0, owner: 'you', x: 300, y: 300, target: 1, count: 10 };
    const theirs: Fleet = { id: 1, owner: 'enemy', x: 300, y: 200, target: 0, count: 10 };
    s.fleets = [mine, theirs];
    s.nextFleetId = 2;
    step(s, { doctrine: true }, 0.1);
    const mineDx = s.fleets.find((f) => f.owner === 'you')!.x - 300;
    const theirsMoved = Math.abs(s.fleets.find((f) => f.owner === 'enemy')!.x - 300);
    expect(mineDx).toBeCloseTo(135 * DOCTRINES.blitz.fleetSpeedMul * 0.1, 3);
    expect(theirsMoved).toBeLessThan(mineDx); // a do inimigo seguiu na velocidade base
  });

  it('Muralha reduz o dano recebido pelas bases do dono enquanto ativa', () => {
    const s = makeState([mkNode(0, 500, 300, 'you', 0, 10), mkNode(1, 600, 300, 'enemy', 0, 1)]);
    s.doctrines.you.id = 'bulwark';
    s.doctrines.you.activeLeft = 5; // ativa "no ar"
    s.fleets = [{ id: 0, owner: 'enemy', x: 499, y: 300, target: 0, count: 10 }];
    s.nextFleetId = 1;
    const dt = 0.05;
    step(s, undefined, dt);
    // sem Muralha o empate 10×10 zeraria a defesa; com ela sobra a diferença
    // (+ a produção do próprio step, que acontece antes da chegada).
    expect(s.nodes[0]!.owner).toBe('you');
    expect(s.nodes[0]!.troops).toBeCloseTo(
      10 + TIERS[0]!.prod * dt - 10 * DOCTRINES.bulwark.dmgTakenMul,
      3,
    );
  });

  it('a IA ativa a própria doutrina na hora certa (Muralha sob ataque, Mobilização em paz)', () => {
    const wall = makeState([mkNode(0, 400, 300, 'enemy', 1, 100), mkNode(1, 1200, 650, 'you', 0, 5000)]);
    wall.doctrines.enemy.id = 'bulwark';
    wall.fleets.push({ id: 0, owner: 'you', x: 900, y: 300, target: 0, count: 30 });
    aiThink(wall);
    expect(wall.doctrines.enemy.activeLeft).toBeGreaterThan(0);

    const calm = makeState([mkNode(0, 400, 300, 'enemy', 1, 30), mkNode(1, 1200, 650, 'you', 0, 5000)]);
    calm.doctrines.enemy.id = 'surge';
    aiThink(calm);
    expect(calm.doctrines.enemy.activeLeft).toBeGreaterThan(0);
  });

  it('doutrina da IA segue a persona (identidade estratégica)', () => {
    expect(createInitialState(1, { persona: 'rusher' }).doctrines.enemy.id).toBe('blitz');
    expect(createInitialState(1, { persona: 'turtle' }).doctrines.enemy.id).toBe('bulwark');
    expect(createInitialState(1, { persona: 'boomer' }).doctrines.enemy.id).toBe('surge');
    expect(createInitialState(1, { doctrineYou: 'bulwark' }).doctrines.you.id).toBe('bulwark');
  });
});

describe('Mapgen denso com layouts (F4-lite — MAPGEN)', () => {
  it('gera mapas maiores, com estrutura 2 capitais + core + PARES espelhados', () => {
    for (const seed of [1, 2, 3, 7, 42]) {
      const s = createInitialState(seed);
      expect(s.nodes.length).toBeGreaterThanOrEqual(13); // ≥5 pares além do trio fixo
      expect((s.nodes.length - 3) % 2).toBe(0);
      const W = s.config.worldW;
      const H = s.config.worldH;
      for (let i = 3; i + 1 < s.nodes.length; i += 2) {
        expect(s.nodes[i]!.x + s.nodes[i + 1]!.x).toBeCloseTo(W, 4);
        expect(s.nodes[i]!.y + s.nodes[i + 1]!.y).toBeCloseTo(H, 4);
      }
    }
  });

  it('o layout varia por seed (classic/lanes/flanks aparecem)', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) seen.add(createInitialState(seed).layout);
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('três pares de zonas de mapa (mais textura p/ mapas maiores)', () => {
    const s = createInitialState(5);
    expect(s.zones?.length).toBe(6);
  });
});
