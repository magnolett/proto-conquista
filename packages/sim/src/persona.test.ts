import { describe, it, expect } from 'vitest';
import type { AIPersona, Difficulty } from '@conquista/shared';
import {
  createInitialState,
  aiThink,
  effectiveAI,
  mkNode,
  segmentCircleChord,
  type GameState,
} from './index.js';

function makeState(
  difficulty: Difficulty,
  persona: AIPersona,
  nodes: GameState['nodes'],
): GameState {
  return {
    nodes,
    fleets: [],
    rng: 12345 >>> 0,
    seed: 12345,
    time: 0,
    aiTimer: 0,
    difficulty,
    persona,
    gameOver: false,
    winner: null,
    nextFleetId: 0,
    config: { fleetSpeed: 135, sendDefault: 0.5, worldW: 1280, worldH: 720 },
    fx: [],
    coreHold: { owner: null, held: 0 },
    winReason: null,
  };
}

describe('Persona da IA (F2.5) — sorteio', () => {
  it('é determinística por seed (mesma seed ⇒ mesma persona)', () => {
    const a = createInitialState(0xbeef, { difficulty: 'normal' });
    const b = createInitialState(0xbeef, { difficulty: 'normal' });
    expect(b.persona).toBe(a.persona);
  });

  it('easy é SEMPRE equilibrada (didática/previsível)', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      expect(createInitialState(seed, { difficulty: 'easy' }).persona).toBe('balanced');
    }
  });

  it('seeds variadas produzem personas variadas (normal)', () => {
    const seen = new Set<AIPersona>();
    for (let seed = 1; seed <= 20; seed++) {
      seen.add(createInitialState(seed, { difficulty: 'normal' }).persona);
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('opts.persona força a persona (útil p/ replays e testes)', () => {
    expect(createInitialState(7, { difficulty: 'normal', persona: 'turtle' }).persona).toBe(
      'turtle',
    );
  });
});

describe('effectiveAI — dificuldade × persona', () => {
  it('modula tick/limiar e decide coordenação', () => {
    const rusher = effectiveAI('normal', 'rusher');
    expect(rusher.aiTick).toBeCloseTo(0.7 * 0.85, 6);
    expect(rusher.coordinated).toBe(true);
    expect(effectiveAI('normal', 'balanced').coordinated).toBe(false);
    expect(effectiveAI('hard', 'balanced').coordinated).toBe(true); // hard sempre coordena
  });
});

describe('Personas jogam DIFERENTE (mesmo estado, decisões distintas)', () => {
  it('rusher ataca com excedente que a boomer ainda considera pouco', () => {
    // Guarnição 35: entre os limiares efetivos (cap T2=58 × 0.6 × mul) —
    // rusher 0.75⇒26.1 < 35 ataca · boomer 1.05⇒36.5 > 35 segura (diais 2026-07-06).
    const build = (persona: AIPersona) => {
      const target = mkNode(0, 700, 300, 'neutral', 0, 5);
      const atk = mkNode(1, 600, 300, 'enemy', 1, 35); // cap T2=58
      return makeState('normal', persona, [target, atk]);
    };
    const rush = build('rusher');
    aiThink(rush);
    expect(rush.fleets.some((f) => f.target === 0)).toBe(true);

    const boom = build('boomer');
    aiThink(boom);
    expect(boom.fleets.length).toBe(0);
  });

  it('turtle reforça sob ameaça que a equilibrada ainda tolera', () => {
    const build = (persona: AIPersona) => {
      const front = mkNode(0, 400, 300, 'enemy', 1, 100);
      const helper = mkNode(1, 500, 300, 'enemy', 0, 50);
      const s = makeState('normal', persona, [front, helper]);
      // ameaça de 70 tropas: 70% da guarnição (não dispara o limiar padrão de 0.9)
      s.fleets.push({ id: s.nextFleetId++, owner: 'you', x: 900, y: 300, target: 0, count: 70 });
      return s;
    };
    const balanced = build('balanced');
    aiThink(balanced);
    expect(balanced.fleets.filter((f) => f.owner === 'enemy' && f.target === 0).length).toBe(0);

    const turtle = build('turtle'); // limiar 0.9×0.6 = 0.54 < 0.7 ⇒ defende
    aiThink(turtle);
    expect(turtle.fleets.filter((f) => f.owner === 'enemy' && f.target === 0).length).toBe(1);
  });
});

describe('ALL-IN coordenado (F2.5)', () => {
  const scenario = (difficulty: Difficulty, persona: AIPersona): GameState => {
    const wall = mkNode(0, 600, 300, 'you', 1, 80); // ninguém toma sozinho
    const a1 = mkNode(1, 500, 250, 'enemy', 2, 100);
    const a2 = mkNode(2, 500, 350, 'enemy', 2, 100);
    return makeState(difficulty, persona, [wall, a1, a2]);
  };

  it('persona coordenada SOMA forças contra a muralha intomável', () => {
    const s = scenario('normal', 'rusher');
    aiThink(s);
    const waves = s.fleets.filter((f) => f.owner === 'enemy' && f.target === 0);
    expect(waves.length).toBe(2); // as duas bases atacaram JUNTAS
    const pool = waves.reduce((acc, f) => acc + f.count, 0);
    expect(pool).toBeGreaterThan(80); // e a soma cobre a defesa
  });

  it('equilibrada em dificuldade normal NÃO coordena (fronteira empilhada segura)', () => {
    const s = scenario('normal', 'balanced');
    aiThink(s);
    expect(s.fleets.length).toBe(0);
  });

  it('hard coordena mesmo equilibrada (o difícil sabe jogar)', () => {
    const s = scenario('hard', 'balanced');
    aiThink(s);
    expect(s.fleets.filter((f) => f.target === 0).length).toBe(2);
  });
});

describe('Ciência de canhão na escolha de alvo (F2.5)', () => {
  it('entre alvos gêmeos, evita o que exige cruzar alcance de canhão hostil', () => {
    const A = mkNode(0, 400, 300, 'you', 1, 20);
    const B = mkNode(1, 800, 300, 'you', 1, 20);
    const sentry = mkNode(2, 450, 310, 'you', 2, 200, 'cannon'); // guarda a rota de A
    const atk = mkNode(3, 600, 340, 'enemy', 2, 90);
    const s = makeState('normal', 'balanced', [A, B, sentry, atk]);
    aiThink(s);
    const f = s.fleets.find((x) => x.owner === 'enemy');
    expect(f).toBeDefined();
    expect(f!.target).toBe(B.id); // rota limpa vence
  });

  it('anti-caso: sem canhão na rota, o empate cai no primeiro da lista (A)', () => {
    const A = mkNode(0, 400, 300, 'you', 1, 20);
    const B = mkNode(1, 800, 300, 'you', 1, 20);
    const bystander = mkNode(2, 450, 310, 'you', 2, 200, 'normal'); // mesmo lugar, sem canhão
    const atk = mkNode(3, 600, 340, 'enemy', 2, 90);
    const s = makeState('normal', 'balanced', [A, B, bystander, atk]);
    aiThink(s);
    expect(s.fleets.find((x) => x.owner === 'enemy')!.target).toBe(A.id);
  });
});

describe('segmentCircleChord (geometria pura)', () => {
  it('atravessar o círculo pelo centro = diâmetro', () => {
    expect(segmentCircleChord(0, 0, 100, 0, 50, 0, 10)).toBeCloseTo(20, 6);
  });
  it('rota que não toca o círculo = 0', () => {
    expect(segmentCircleChord(0, 0, 100, 0, 50, 50, 10)).toBe(0);
  });
  it('partindo de dentro, conta só o trecho interno', () => {
    expect(segmentCircleChord(50, 0, 100, 0, 50, 0, 10)).toBeCloseTo(10, 6);
  });
  it('segmento degenerado = 0', () => {
    expect(segmentCircleChord(5, 5, 5, 5, 5, 5, 10)).toBe(0);
  });
});
