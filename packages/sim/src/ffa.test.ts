import { describe, it, expect } from 'vitest';
import { createInitialState, step, cloneState } from './index.js';

describe('FFA (F5-lite) — múltiplos rivais', () => {
  it('enemyCount cria capitais e rivais com identidade própria', () => {
    const s = createInitialState(7, { difficulty: 'normal', enemyCount: 3 });
    expect(s.rivals?.length).toBe(2);
    expect(s.rivals!.map((r) => r.id)).toEqual(['e2', 'e3']);
    const owners = new Set(s.nodes.map((n) => n.owner));
    expect(owners.has('you')).toBe(true);
    expect(owners.has('enemy')).toBe(true);
    expect(owners.has('e2')).toBe(true);
    expect(owners.has('e3')).toBe(true);
    // capitais nos 4 primeiros índices (você + 3 IAs) e o core na sequência
    expect(s.nodes[0]!.owner).toBe('you');
    expect(s.nodes[4]!.isCore).toBe(true);
  });

  it('default continua 1v1 (compatibilidade): sem rivals, espelho de capitais', () => {
    const s = createInitialState(7, { difficulty: 'normal' });
    expect(s.rivals).toBeUndefined();
    const W = s.config.worldW;
    const H = s.config.worldH;
    expect(s.nodes[0]!.x + s.nodes[1]!.x).toBeCloseTo(W, 4);
    expect(s.nodes[0]!.y + s.nodes[1]!.y).toBeCloseTo(H, 4);
  });

  it('as IAs extras AGEM (frotas de e2/e3 aparecem) e o estado segue determinístico', () => {
    const run = (): string => {
      const s = createInitialState(0xfeed, { difficulty: 'hard', enemyCount: 3 });
      const seen = new Set<string>();
      for (let i = 0; i < 3000 && !s.gameOver; i++) {
        step(s, undefined, 1 / 60);
        for (const f of s.fleets) seen.add(f.owner);
      }
      expect(seen.has('e2')).toBe(true);
      expect(seen.has('e3')).toBe(true);
      return JSON.stringify(cloneState(s));
    };
    expect(run()).toBe(run());
  });

  it('vitória FFA: o jogador só vence quando NENHUM rival resta', () => {
    const s = createInitialState(11, { difficulty: 'normal', enemyCount: 2 });
    // zera o 'enemy': ainda há e2 vivo ⇒ jogo segue
    for (const n of s.nodes) if (n.owner === 'enemy') n.owner = 'neutral';
    step(s, undefined, 0.05);
    expect(s.gameOver).toBe(false);
    // zera o e2 também ⇒ vitória
    for (const n of s.nodes) if (n.owner === 'e2') n.owner = 'neutral';
    s.fleets = s.fleets.filter((f) => f.owner === 'you');
    step(s, undefined, 0.05);
    expect(s.gameOver).toBe(true);
    expect(s.winner).toBe('you');
  });

  it('derrota imediata quando o jogador cai, mesmo com IAs vivas brigando', () => {
    const s = createInitialState(13, { difficulty: 'normal', enemyCount: 3 });
    for (const n of s.nodes) if (n.owner === 'you') n.owner = 'neutral';
    s.fleets = [];
    step(s, undefined, 0.05);
    expect(s.gameOver).toBe(true);
    expect(s.winner).not.toBe('you');
  });

  it('rival extra pode vencer por DOMÍNIO do centro (derrota sua)', () => {
    const s = createInitialState(17, { difficulty: 'normal', enemyCount: 2 });
    const core = s.nodes.find((n) => n.isCore)!;
    core.owner = 'e2';
    s.coreHold = { owner: 'e2', held: 9999 }; // já segurou o suficiente
    step(s, undefined, 0.05);
    expect(s.gameOver).toBe(true);
    expect(s.winner).toBe('e2');
    expect(s.winReason).toBe('core');
  });

  it('partida FFA completa termina em tempo finito (anti-stall com 3 IAs)', () => {
    const s = createInitialState(0xabc, { difficulty: 'hard', enemyCount: 3 });
    const maxSteps = 15 * 60 * 60; // 15 min simulados
    for (let i = 0; i < maxSteps && !s.gameOver; i++) step(s, undefined, 1 / 60);
    expect(s.gameOver).toBe(true); // jogador passivo não sobrevive a 3 IAs
    expect(s.winner).not.toBe('you');
  });

  it('as IAs brigam ENTRE SI: envios e capturas IA→IA acontecem (trava do FFA real)', () => {
    // Garantia pedida pelo dono: FFA não pode degenerar em "todas contra o
    // jogador". A IA não conhece 'jogador' — só rivais; este teste TRAVA isso.
    const AI_OWNERS = new Set<string>(['enemy', 'e2', 'e3']);
    for (const seed of [3, 0xfeed, 99]) {
      const s = createInitialState(seed, { difficulty: 'hard', enemyCount: 3 });
      const seenFleets = new Set<number>();
      let aiVsAiSends = 0;
      let aiVsAiCaptures = 0;
      const prevOwners = s.nodes.map((n) => n.owner);
      for (let i = 0; i < 6 * 60 * 60 && !s.gameOver; i++) {
        step(s, undefined, 1 / 60);
        for (const f of s.fleets) {
          if (seenFleets.has(f.id)) continue;
          seenFleets.add(f.id);
          const t = s.nodes[f.target];
          if (t && AI_OWNERS.has(f.owner) && AI_OWNERS.has(t.owner) && t.owner !== f.owner) {
            aiVsAiSends++;
          }
        }
        for (let k = 0; k < s.nodes.length; k++) {
          const now = s.nodes[k]!.owner;
          const was = prevOwners[k]!;
          if (now !== was && AI_OWNERS.has(now) && AI_OWNERS.has(was)) aiVsAiCaptures++;
          prevOwners[k] = now;
        }
      }
      // eslint-disable-next-line no-console
      console.log(
        `seed ${seed}: ${aiVsAiSends} ataques IA→IA · ${aiVsAiCaptures} capturas IA→IA em ${s.time.toFixed(0)}s`,
      );
      expect(aiVsAiSends).toBeGreaterThan(0); // IAs se atacam…
      expect(aiVsAiSends + aiVsAiCaptures).toBeGreaterThan(5); // …e é briga, não acidente
    }
  });
});
