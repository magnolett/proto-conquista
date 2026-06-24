import { describe, it, expect } from 'vitest';
import { DIFFICULTY } from '@conquista/shared';
import { mkNode, aiThink } from './index.js';
import type { GameState } from './index.js';

/** Monta um GameState mínimo p/ exercitar a IA isoladamente. */
function makeState(difficulty: GameState['difficulty'], nodes: GameState['nodes']): GameState {
  return {
    nodes,
    fleets: [],
    rng: 12345 >>> 0,
    seed: 12345,
    time: 0,
    aiTimer: 0,
    difficulty,
    gameOver: false,
    winner: null,
    nextFleetId: 0,
    config: { fleetSpeed: 135, sendDefault: 0.5, worldW: 1280, worldH: 720 },
  };
}

describe('IA — FIX da superinvestida (committed[])', () => {
  it('frota em VOO já cobrindo o alvo conta como committed ⇒ atacante fraco não reforça', () => {
    // Semântica EXATA do contrato: committed inclui frotas inimigas JÁ mirando o nó.
    // Alvo com 20 de defesa; já há uma frota da IA (count 30) a caminho ⇒ committed=30.
    // O único atacante tem force pequeno (floor de troops*expandForce) que NÃO supera
    // needed = 20 - 30 = -10 só se force > -9... então usamos um alvo cujo needed
    // pós-committed AINDA exige mais do que o atacante tem.
    const target = mkNode(0, 600, 360, 'neutral', 0, 60); // defesa alta
    const a1 = mkNode(1, 610, 370, 'enemy', 1, 40); // cap T2=58; 40 > 58*thresh? não em hard(0.55*58=31.9) ⇒ sim
    const s = makeState('hard', [target, a1]);
    // frota da IA já em voo cobrindo PARTE da defesa (committed = 24).
    s.fleets.push({ id: s.nextFleetId++, owner: 'enemy', x: 0, y: 0, target: 0, count: 24 });
    // force = floor(40 * 0.65) = 26; needed = 60 - 24 = 36; 26 <= 36+1 ⇒ NÃO ataca.
    aiThink(s);
    const newToTarget = s.fleets.filter((f) => f.target === 0 && f.count === 26);
    expect(newToTarget.length).toBe(0); // o atacante fraco não reforça um alvo já meio-comprometido
  });

  it('committed PARCIAL: atacante forte o bastante p/ o RESTANTE ainda ataca', () => {
    // Complementa o teste acima: committed reduz needed mas não o zera. Um atacante
    // cujo force supera o needed RESTANTE deve, sim, atacar (o fix é honesto, não cego).
    const target = mkNode(0, 600, 360, 'neutral', 0, 60); // defesa 60
    const a1 = mkNode(1, 610, 370, 'enemy', 1, 100); // force = floor(100*0.65)=65
    const s = makeState('hard', [target, a1]);
    // frota em voo cobre só 10 ⇒ needed = 60-10 = 50; 65 > 51 ⇒ ataca.
    s.fleets.push({ id: s.nextFleetId++, owner: 'enemy', x: 0, y: 0, target: 0, count: 10 });
    aiThink(s);
    expect(s.fleets.some((f) => f.target === 0 && f.count === 65)).toBe(true);
  });

  it('committed espalha os atacantes: 3 bases não empilham no mesmo alvo já reservado', () => {
    // 3 atacantes fortes e 3 alvos baratos. Sem o committed, o de melhor score (A,
    // perto/barato) atrairia mais de um. Com o committed[] + o skip de "já coberto",
    // o 1º atacante reserva A e os seguintes se espalham por B/C.
    const A = mkNode(0, 600, 360, 'neutral', 0, 8); // alvo principal barato
    const B = mkNode(1, 200, 150, 'neutral', 1, 12); // alternativo
    const C = mkNode(2, 1000, 600, 'neutral', 1, 12); // alternativo
    const a1 = mkNode(3, 610, 370, 'enemy', 0, 100);
    const a2 = mkNode(4, 590, 350, 'enemy', 0, 100);
    const a3 = mkNode(5, 620, 360, 'enemy', 0, 100);
    const s = makeState('hard', [A, B, C, a1, a2, a3]);
    aiThink(s);
    const targetsHit = new Set(s.fleets.filter((f) => f.owner === 'enemy').map((f) => f.target));
    expect(targetsHit.size).toBeGreaterThanOrEqual(2); // espalhou, não empilhou tudo num nó
    expect(s.fleets.filter((f) => f.target === A.id).length).toBe(1); // A reservado: tomado uma vez
  });

  it('alvo JÁ super-coberto em voo (committed > troops) não recebe pile, nem sendo o único viável', () => {
    // Refinamento do orquestrador (paridade com o integ-proto): se o que já está a
    // caminho basta p/ capturar, não manda reforço redundante — nem se não houver outro alvo.
    const A = mkNode(0, 600, 360, 'neutral', 0, 10);
    const a1 = mkNode(1, 610, 370, 'enemy', 0, 100);
    const s = makeState('hard', [A, a1]);
    s.fleets.push({ id: s.nextFleetId++, owner: 'enemy', x: 0, y: 0, target: 0, count: 20 }); // 20 > 10 ⇒ já garantido
    aiThink(s);
    expect(s.fleets.filter((f) => f.target === 0 && f.count !== 20).length).toBe(0);
  });

  it('sem alvo viável (defesa alta demais p/ a força), a IA não ataca', () => {
    const target = mkNode(0, 600, 360, 'neutral', 0, 5000);
    const a1 = mkNode(1, 610, 370, 'enemy', 0, 100);
    const s = makeState('hard', [target, a1]);
    aiThink(s);
    expect(s.fleets.filter((f) => f.target === target.id).length).toBe(0);
  });

  it('usa expandForce da dificuldade no tamanho da frota', () => {
    const target = mkNode(0, 600, 360, 'neutral', 0, 3);
    const a1 = mkNode(1, 610, 370, 'enemy', 0, 100);
    const s = makeState('easy', [target, a1]);
    aiThink(s);
    const f = s.fleets.find((x) => x.target === target.id);
    expect(f).toBeDefined();
    // easy.expandForce = 0.55 ⇒ floor(100*0.55) = 55
    expect(f!.count).toBe(Math.floor(100 * DIFFICULTY.easy.expandForce));
  });

  it('é determinística: mesmo estado inicial ⇒ mesmas frotas', () => {
    const build = () => {
      const target = mkNode(0, 600, 360, 'you', 1, 8);
      const a1 = mkNode(1, 610, 370, 'enemy', 0, 100);
      const a2 = mkNode(2, 300, 200, 'enemy', 0, 80);
      return makeState('normal', [target, a1, a2]);
    };
    const s1 = build();
    const s2 = build();
    aiThink(s1);
    aiThink(s2);
    expect(s2.fleets).toStrictEqual(s1.fleets);
    expect(s2.rng).toBe(s1.rng);
  });
});
