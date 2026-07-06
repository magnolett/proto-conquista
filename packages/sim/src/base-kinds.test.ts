import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  step,
  cloneState,
  mkNode,
  resolveArrival,
  spawnFleet,
  type Fleet,
} from './index.js';
import { BASE_KINDS } from '@conquista/shared';

describe('Tipos de base — escudo (dmgTakenMul)', () => {
  it('reduz o dano recebido em ataque (mais caro de tomar)', () => {
    const shielded = mkNode(0, 0, 0, 'enemy', 0, 10, 'shield');
    const normal = mkNode(1, 0, 0, 'enemy', 0, 10, 'normal');
    resolveArrival({ id: 0, owner: 'you', x: 0, y: 0, target: 0, count: 12 }, shielded);
    resolveArrival({ id: 1, owner: 'you', x: 0, y: 0, target: 1, count: 12 }, normal);
    // normal: 12 vs 10 ⇒ vira com 2. escudo: dano 12*0.6=7.2 < 10 ⇒ NÃO vira (sobra 2.8).
    expect(normal.owner).toBe('you');
    expect(shielded.owner).toBe('enemy');
    expect(shielded.troops).toBeCloseTo(10 - 12 * BASE_KINDS.shield.dmgTakenMul, 6);
  });

  it('ainda é capturável com força suficiente', () => {
    const shielded = mkNode(0, 0, 0, 'enemy', 0, 10, 'shield');
    resolveArrival({ id: 0, owner: 'you', x: 0, y: 0, target: 0, count: 30 }, shielded);
    // dano 30*0.6=18 > 10 ⇒ vira com 8.
    expect(shielded.owner).toBe('you');
    expect(shielded.troops).toBeCloseTo(18 - 10, 6);
  });

  it('não afeta reforço (mesma cor soma normal)', () => {
    const shielded = mkNode(0, 0, 0, 'you', 0, 10, 'shield');
    resolveArrival({ id: 0, owner: 'you', x: 0, y: 0, target: 0, count: 12 }, shielded);
    expect(shielded.troops).toBe(22); // 10 + 12, sem redução
  });
});

describe('Tipos de base — veloz (fleetSpeedMul)', () => {
  it('frota que parte de base veloz herda speedMul > 1', () => {
    const s = createInitialState(1);
    const src = mkNode(0, 100, 300, 'you', 0, 50, 'fast');
    const tgt = mkNode(1, 900, 300, 'neutral', 0, 10, 'normal');
    s.nodes = [src, tgt];
    s.fleets = [];
    s.nextFleetId = 0;
    spawnFleet(s, src, tgt, 'you', 20);
    expect(s.fleets[0]!.speedMul).toBe(BASE_KINDS.fast.fleetSpeedMul);
  });

  it('cobre mais distância por step que uma frota normal', () => {
    const advance = (kind: 'normal' | 'fast'): number => {
      const s = createInitialState(1);
      const src = mkNode(0, 100, 300, 'you', 0, 50, kind);
      const tgt = mkNode(1, 1100, 300, 'neutral', 0, 10, 'normal');
      s.nodes = [src, tgt];
      s.fleets = [];
      s.nextFleetId = 0;
      spawnFleet(s, src, tgt, 'you', 20);
      step(s, undefined, 0.1);
      return s.fleets[0]!.x;
    };
    expect(advance('fast')).toBeGreaterThan(advance('normal'));
  });
});

describe('Tipos de base — canhão (range/dps)', () => {
  it('afina frota de outro dono no alcance e poupa a própria', () => {
    const s = createInitialState(1);
    const cannon = mkNode(0, 500, 300, 'you', 0, 30, 'cannon');
    const far = mkNode(1, 500, 1500, 'neutral', 0, 10, 'normal'); // alvo longe: não chega
    // âncora ENEMY pobre perto da frota inimiga: mantém-na SUPRIDA (F2.5) — este
    // teste isola o canhão; atrito de suprimento tem testes próprios.
    const anchor = mkNode(2, 505, 260, 'enemy', 0, 1);
    s.nodes = [cannon, far, anchor];
    // As duas frotas ficam no alcance do canhão (110), mas AFASTADAS entre si
    // (dist ~41 > ENGAGE.radius) p/ não disparar a interceptação da F2.5 —
    // este teste isola o CANHÃO.
    const enemyFleet: Fleet = { id: 0, owner: 'enemy', x: 505, y: 300, target: 1, count: 50 };
    const ownFleet: Fleet = { id: 1, owner: 'you', x: 495, y: 340, target: 1, count: 50 };
    s.fleets = [enemyFleet, ownFleet];
    s.nextFleetId = 2;
    step(s, undefined, 0.05);
    const en = s.fleets.find((f) => f.owner === 'enemy')!;
    const mine = s.fleets.find((f) => f.owner === 'you')!;
    expect(en.count).toBeCloseTo(50 - BASE_KINDS.cannon.cannonDps * 0.05, 6); // afinada
    expect(mine.count).toBe(50); // dono do canhão não é atingido
  });

  it('não atinge frota fora do alcance', () => {
    const s = createInitialState(1);
    const cannon = mkNode(0, 0, 300, 'you', 0, 30, 'cannon');
    const far = mkNode(1, 1200, 300, 'neutral', 0, 10, 'normal');
    const anchor = mkNode(2, 600, 340, 'enemy', 0, 1); // suprimento da frota inimiga (F2.5)
    s.nodes = [cannon, far, anchor];
    // frota a 600px do canhão (>> range 110), indo p/ o alvo
    const enemyFleet: Fleet = { id: 0, owner: 'enemy', x: 600, y: 300, target: 1, count: 50 };
    s.fleets = [enemyFleet];
    s.nextFleetId = 1;
    step(s, undefined, 0.05);
    expect(s.fleets.find((f) => f.owner === 'enemy')!.count).toBe(50); // intacta
  });
});

describe('Tipos de base — determinismo & mapgen', () => {
  it('mapgen atribui kinds determinísticos e espelha cada par neutro', () => {
    const a = createInitialState(0xc0ffee);
    const b = createInitialState(0xc0ffee);
    expect(a.nodes.map((n) => n.kind)).toEqual(b.nodes.map((n) => n.kind));
    // nós 3,4 / 5,6 / ... são pares espelhados ⇒ mesmo kind (justiça).
    for (let i = 3; i + 1 < a.nodes.length; i += 2) {
      expect(a.nodes[i]!.kind).toBe(a.nodes[i + 1]!.kind);
    }
  });

  it('partida com kinds roda 2× e dá estado final idêntico', () => {
    const run = (): string => {
      const s = createInitialState(7, { difficulty: 'normal' });
      for (let i = 0; i < 300; i++) step(s, undefined, 1 / 60);
      return JSON.stringify(cloneState(s));
    };
    expect(run()).toBe(run());
  });
});
