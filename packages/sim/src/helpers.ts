import { TIERS, upgradeCost, BASE_KINDS, SCORE } from '@conquista/shared';
import type { BaseKind, Owner } from '@conquista/shared';
import type { Node, Fleet, GameState, Zone } from './types.js';

/** Distância euclidiana entre dois pontos. */
export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Aplica os derivados de tier a um nó (espelha applyTier do game.js). */
export function applyTier(n: Node): void {
  const t = TIERS[Math.min(n.tier, TIERS.length - 1)]!;
  n.prod = t.prod;
  n.cap = t.cap;
  n.radius = t.r;
}

/** Cria um nó já com os derivados de tier aplicados. */
export function mkNode(
  id: number,
  x: number,
  y: number,
  owner: Node['owner'],
  tier: number,
  troops: number,
  kind: BaseKind = 'normal',
): Node {
  const n: Node = {
    id,
    x,
    y,
    owner,
    kind,
    tier,
    troops,
    prod: 0,
    cap: 0,
    radius: 0,
    pulse: 0,
    underAttack: false,
  };
  applyTier(n);
  return n;
}

/**
 * Cria uma frota saindo da borda da base de origem rumo ao alvo.
 * Espelha spawnFleet do game.js (posição inicial na borda do raio).
 * Muta `state` (push em fleets + incrementa nextFleetId).
 */
export function spawnFleet(
  state: GameState,
  sn: Node,
  tn: Node,
  owner: Fleet['owner'],
  count: number,
): void {
  const dx = tn.x - sn.x;
  const dy = tn.y - sn.y;
  const d = Math.hypot(dx, dy) || 1;
  state.fleets.push({
    id: state.nextFleetId++,
    owner,
    x: sn.x + (dx / d) * sn.radius,
    y: sn.y + (dy / d) * sn.radius,
    target: tn.id,
    count,
    speedMul: BASE_KINDS[sn.kind].fleetSpeedMul,
  });
}

/**
 * Resolve a chegada de uma frota ao nó-alvo (espelha resolveArrival).
 * Mesma cor = reforço (soma, pode passar do cap). Cor diferente = ataque:
 * subtrai; se a defesa fica negativa, a base VIRA com o excedente.
 */
export function resolveArrival(f: Fleet, tn: Node): void {
  if (tn.owner === f.owner) {
    tn.troops += f.count;
  } else {
    // Escudo (dmgTakenMul < 1) absorve parte do ataque; 'normal' usa 1 ⇒ regra intacta.
    const dmg = f.count * BASE_KINDS[tn.kind].dmgTakenMul;
    tn.troops -= dmg;
    if (tn.troops < 0) {
      tn.owner = f.owner;
      tn.troops = -tn.troops;
      tn.pulse = 1;
    } else {
      tn.pulse = 0.5;
    }
  }
}

/**
 * Aplica um upgrade a um nó se possível (espelha upgradeNode).
 * Retorna true se o upgrade ocorreu.
 */
export function upgradeNode(n: Node): boolean {
  if (n.tier >= TIERS.length - 1) return false;
  const cost = upgradeCost(n.tier);
  if (n.troops < cost) return false;
  n.troops -= cost;
  n.tier++;
  applyTier(n);
  n.pulse = 1;
  return true;
}

/**
 * Multiplicador de velocidade no ponto (x,y): produto das zonas que o contêm (F2).
 * Sem zonas — ou nenhuma contendo o ponto — ⇒ 1 (sem efeito). Função pura.
 */
export function zoneMulAt(x: number, y: number, zones: Zone[] | undefined): number {
  if (!zones || zones.length === 0) return 1;
  let m = 1;
  for (const z of zones) {
    const dx = x - z.x;
    const dy = y - z.y;
    if (dx * dx + dy * dy <= z.radius * z.radius) m *= z.speedMul;
  }
  return m;
}

/**
 * Pontuação de um lado (F2 — placar): bases, tropas (em base + em trânsito) e tiers,
 * ponderados por SCORE. Função pura — usada no HUD/placar, nunca na regra.
 */
export function computeScore(state: GameState, owner: Owner): number {
  let bases = 0;
  let troops = 0;
  let tierSum = 0;
  for (const n of state.nodes) {
    if (n.owner !== owner) continue;
    bases++;
    troops += n.troops;
    tierSum += n.tier;
  }
  for (const f of state.fleets) if (f.owner === owner) troops += f.count;
  return Math.round(bases * SCORE.baseW + troops + tierSum * SCORE.tierW);
}

/**
 * Ids dos nós VISÍVEIS ao jogador (F2 — névoa de guerra): suas bases são sempre
 * visíveis; as demais só se estiverem a até `sightRadius` de uma base ou frota sua.
 * Função pura (não muta) — afeta só a apresentação, nunca a regra/IA.
 */
export function visibleNodeIds(state: GameState, sightRadius: number): Set<number> {
  const r2 = sightRadius * sightRadius;
  const sources: Array<{ x: number; y: number }> = [];
  for (const n of state.nodes) if (n.owner === 'you') sources.push({ x: n.x, y: n.y });
  for (const f of state.fleets) if (f.owner === 'you') sources.push({ x: f.x, y: f.y });
  const vis = new Set<number>();
  for (const n of state.nodes) {
    if (n.owner === 'you') {
      vis.add(n.id);
      continue;
    }
    for (const s of sources) {
      const dx = n.x - s.x;
      const dy = n.y - s.y;
      if (dx * dx + dy * dy <= r2) {
        vis.add(n.id);
        break;
      }
    }
  }
  return vis;
}
