import { describe, it, expect } from 'vitest';
import { UPGRADE, upgradeCost } from '@conquista/shared';
import {
  createInitialState,
  step,
  mkNode,
  upgradeNode,
  finishUpgrade,
  effectiveDmgMul,
  resolveArrival,
  aiThink,
  type GameState,
} from './index.js';

/** Monta um GameState mínimo (mesmo shape do helper de ai.test). */
function makeState(difficulty: GameState['difficulty'], nodes: GameState['nodes']): GameState {
  return {
    nodes,
    fleets: [],
    rng: 12345 >>> 0,
    seed: 12345,
    time: 0,
    aiTimer: 0,
    difficulty,
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

describe('Obra de upgrade (F2.5) — paga agora, evolui depois', () => {
  it('upgradeNode INICIA a obra: custo debitado, tier inalterado, prazo por nível', () => {
    const n = mkNode(0, 100, 100, 'you', 0, 30);
    expect(upgradeNode(n)).toBe(true);
    expect(n.troops).toBe(30 - upgradeCost(0));
    expect(n.tier).toBe(0); // ainda em obra
    expect(n.upgrading).toBeDefined();
    expect(n.upgrading!.total).toBeCloseTo(UPGRADE.timePerTier * 1, 6);
    expect(n.upgrading!.kind).toBe('normal'); // sem escolha ⇒ mantém o kind
  });

  it('não aceita obra em dobro (2º pedido é recusado sem cobrar)', () => {
    const n = mkNode(0, 100, 100, 'you', 0, 60);
    upgradeNode(n);
    const troopsAfterFirst = n.troops;
    expect(upgradeNode(n)).toBe(false);
    expect(n.troops).toBe(troopsAfterFirst);
  });

  it('via step: produção PARA durante a obra e ela conclui no prazo com o kind escolhido', () => {
    const s = createInitialState(3, { difficulty: 'normal' });
    for (const n of s.nodes) {
      n.owner = 'neutral'; // desliga produção alheia
      n.troops = 50;
    }
    const me = s.nodes[0]!;
    me.owner = 'you';
    me.tier = 0;
    me.troops = 30;
    // Uma base inimiga POBRE precisa existir: sem ela checkWin encerra a partida
    // no 1º step (e o step congela); com troops 1 a IA não age (não ataca nem upa).
    s.nodes[1]!.owner = 'enemy';
    s.nodes[1]!.troops = 1;
    expect(upgradeNode(me, 'fast')).toBe(true);
    const paid = me.troops;

    step(s, undefined, 0.5);
    expect(me.troops).toBeCloseTo(paid, 9); // obra ⇒ produção suspensa
    expect(me.tier).toBe(0);

    // completa o prazo (total = timePerTier × 1)
    const total = me.upgrading!.total;
    for (let t = 0.5; t < total + 0.6; t += 0.5) step(s, undefined, 0.5);
    expect(me.upgrading).toBeUndefined();
    expect(me.tier).toBe(1);
    expect(me.kind).toBe('fast');
    expect(me.troops).toBeGreaterThan(paid); // produção voltou (e agora T2)
  });

  it('vulnerabilidade: dano ×vulnMul em obra; escudo em obra perde a proteção', () => {
    const n = mkNode(0, 0, 0, 'enemy', 0, 10);
    n.upgrading = { kind: 'normal', remaining: 5, total: 5 };
    resolveArrival({ id: 0, owner: 'you', x: 0, y: 0, target: 0, count: 5 }, n);
    expect(n.troops).toBeCloseTo(10 - 5 * UPGRADE.vulnMul, 6);

    const sh = mkNode(1, 0, 0, 'enemy', 0, 10, 'shield');
    expect(effectiveDmgMul(sh)).toBeLessThan(1); // escudo íntegro protege
    sh.upgrading = { kind: 'shield', remaining: 5, total: 5 };
    expect(effectiveDmgMul(sh)).toBeCloseTo(UPGRADE.vulnMul, 6); // aberto: max(0.6,1)×vuln
  });

  it('captura durante a obra CANCELA o investimento (timing attack real)', () => {
    const n = mkNode(0, 0, 0, 'enemy', 0, 30);
    upgradeNode(n); // paga 20, fica com 10 em obra
    resolveArrival({ id: 0, owner: 'you', x: 0, y: 0, target: 0, count: 20 }, n);
    expect(n.owner).toBe('you'); // 20×1.3 = 26 > 10 ⇒ vira
    expect(n.upgrading).toBeUndefined(); // obra morta
    expect(n.tier).toBe(0); // o tier comprado nunca chega
  });

  it('dial timePerTier = 0 ⇒ upgrade instantâneo (regra antiga preservada)', () => {
    const old = UPGRADE.timePerTier;
    UPGRADE.timePerTier = 0;
    try {
      const n = mkNode(0, 0, 0, 'you', 0, 30);
      expect(upgradeNode(n, 'cannon')).toBe(true);
      expect(n.tier).toBe(1);
      expect(n.kind).toBe('cannon');
      expect(n.upgrading).toBeUndefined();
    } finally {
      UPGRADE.timePerTier = old;
    }
  });

  it('finishUpgrade aplica tier + kind + derivados', () => {
    const n = mkNode(0, 0, 0, 'you', 0, 10);
    n.upgrading = { kind: 'shield', remaining: 0, total: 6 };
    const prodBefore = n.prod;
    finishUpgrade(n);
    expect(n.tier).toBe(1);
    expect(n.kind).toBe('shield');
    expect(n.prod).toBeGreaterThan(prodBefore);
    expect(n.upgrading).toBeUndefined();
  });
});

describe('IA × obra (F2.5)', () => {
  it('entre dois alvos gêmeos, prefere o que está em OBRA (punir greed)', () => {
    const A = mkNode(0, 500, 300, 'you', 1, 20);
    const B = mkNode(1, 700, 300, 'you', 1, 20);
    B.upgrading = { kind: 'normal', remaining: 5, total: 5 };
    const atk = mkNode(2, 600, 340, 'enemy', 2, 90); // equidistante de A e B
    const s = makeState('normal', [A, B, atk]);
    aiThink(s);
    const f = s.fleets.find((x) => x.owner === 'enemy');
    expect(f).toBeDefined();
    expect(f!.target).toBe(B.id);
  });

  it('não inicia obra em base com ataque a caminho', () => {
    const me = mkNode(0, 400, 400, 'enemy', 0, 100);
    const far = mkNode(1, 1200, 100, 'you', 0, 5000); // forte demais p/ atacar
    const s = makeState('hard', [me, far]);
    s.fleets.push({ id: s.nextFleetId++, owner: 'you', x: 1200, y: 120, target: 0, count: 5 });
    for (let i = 0; i < 30; i++) aiThink(s);
    expect(me.upgrading).toBeUndefined();
  });

  it('especialização posicional: fronteira ⇒ escudo · retaguarda ⇒ veloz · centro ⇒ canhão', () => {
    const runUntilBuild = (nodes: GameState['nodes'], watched: number): GameState['nodes'][number] => {
      const s = makeState('hard', nodes);
      for (let i = 0; i < 80 && !s.nodes[watched]!.upgrading; i++) aiThink(s);
      return s.nodes[watched]!;
    };
    // fronteira: longe do centro, colada no jogador (forte demais p/ atacar)
    const frontier = runUntilBuild(
      [mkNode(0, 100, 650, 'you', 0, 5000), mkNode(1, 150, 650, 'enemy', 0, 100)],
      1,
    );
    expect(frontier.upgrading?.kind).toBe('shield');
    // retaguarda: longe do centro e do jogador
    const rear = runUntilBuild(
      [mkNode(0, 1200, 650, 'you', 0, 5000), mkNode(1, 100, 100, 'enemy', 0, 100)],
      1,
    );
    expect(rear.upgrading?.kind).toBe('fast');
    // centro do mapa
    const central = runUntilBuild(
      [mkNode(0, 100, 100, 'you', 0, 5000), mkNode(1, 640, 360, 'enemy', 0, 100)],
      1,
    );
    expect(central.upgrading?.kind).toBe('cannon');
  });

  it('base já ESPECIAL mantém a vocação ao evoluir', () => {
    const s = makeState('hard', [
      mkNode(0, 100, 100, 'you', 0, 5000),
      mkNode(1, 640, 360, 'enemy', 0, 100, 'shield'), // central, mas já é escudo
    ]);
    for (let i = 0; i < 80 && !s.nodes[1]!.upgrading; i++) aiThink(s);
    expect(s.nodes[1]!.upgrading?.kind).toBe('shield');
  });
});
