import { DIFFICULTY, upgradeCost } from '@conquista/shared';
import type { GameState, Node } from './types.js';
import { dist, spawnFleet, upgradeNode } from './helpers.js';
import { nextRng } from './prng.js';

/**
 * IA (aiThink) — ESTADO FINAL do contrato de costuras.
 *
 * Joga pelas MESMAS regras do jogador (só lê estado público) e é determinística:
 * todo "acaso" vem do PRNG guardado no state. Muta `state` (frotas, upgrades,
 * state.rng). Os pesos vêm de DIFFICULTY[state.difficulty].
 *
 * Etapas:
 *  1) DEFESA: base ameaçada puxa reforço do vizinho forte mais próximo.
 *  2) ATAQUE/EXPANSÃO: com o FIX da superinvestida (committed[]) — várias bases
 *     da IA não despejam todas no mesmo alvo já garantido.
 *  3) ECONOMIA: com prng < upgradeChance, faz upgrade de uma base segura.
 */
export function aiThink(state: GameState): void {
  const D = DIFFICULTY[state.difficulty];
  const nodes = state.nodes;
  const mine = nodes.filter((n) => n.owner === 'enemy');
  if (mine.length === 0) return;

  // Ameaça percebida: tropas do JOGADOR a caminho de cada base da IA.
  const incoming: Record<number, number> = {};
  for (const f of state.fleets) {
    if (f.owner === 'you') {
      const t = nodes[f.target];
      if (t && t.owner === 'enemy') incoming[t.id] = (incoming[t.id] ?? 0) + f.count;
    }
  }

  // 1) DEFESA — reforço do vizinho forte mais próximo (porte do game.js).
  for (const n of mine) {
    if ((incoming[n.id] ?? 0) > n.troops * 0.9) {
      const helper = mine
        .filter((m) => m.id !== n.id && m.troops > 16)
        .sort((a, b) => dist(a, n) - dist(b, n))[0];
      if (helper) {
        const c = Math.floor(helper.troops * 0.6);
        if (c >= 1) {
          helper.troops -= c;
          spawnFleet(state, helper, n, 'enemy', c);
        }
      }
    }
  }

  // FIX da superinvestida: committed[id] = soma de count das frotas da IA já
  // mirando cada nó (inclui os reforços defensivos recém-criados acima).
  const committed: Record<number, number> = {};
  for (const f of state.fleets) {
    if (f.owner === 'enemy') committed[f.target] = (committed[f.target] ?? 0) + f.count;
  }

  // 2) ATAQUE/EXPANSÃO — atacantes com excedente miram o melhor alvo tomável.
  const attackers = mine
    .filter((n) => n.troops > n.cap * D.expandThresh)
    .sort((a, b) => b.troops - a.troops);

  for (const a of attackers) {
    const force = Math.floor(a.troops * D.expandForce);
    let best: Node | null = null;
    let bestScore = -Infinity;
    for (const t of nodes) {
      if (t.owner === 'enemy') continue;
      const already = committed[t.id] ?? 0;
      if (already > t.troops) continue; // já será capturado pelo que está a caminho — não empilhar
      const needed = t.troops - already;
      if (force <= needed + 1) continue; // só ataca o que AINDA consegue tomar
      const score =
        t.tier * D.tierW - t.troops - dist(a, t) * D.distW + (t.owner === 'you' ? D.antiPlayerW : 0);
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    if (best) {
      const c = Math.floor(a.troops * D.expandForce);
      a.troops -= c;
      spawnFleet(state, a, best, 'enemy', c);
      committed[best.id] = (committed[best.id] ?? 0) + c; // reserva o alvo
    }
  }

  // 3) ECONOMIA — prng < upgradeChance: upgrade de uma base segura da retaguarda.
  const roll = nextRng(state.rng);
  state.rng = roll.state;
  if (roll.value < D.upgradeChance) {
    const safe = mine
      .filter((n) => n.troops >= upgradeCost(n.tier) && !((incoming[n.id] ?? 0) > 0))
      .sort((a, b) => a.tier - b.tier)[0];
    if (safe) upgradeNode(safe);
  }
}
