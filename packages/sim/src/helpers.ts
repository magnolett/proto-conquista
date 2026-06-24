import { TIERS, upgradeCost } from '@conquista/shared';
import type { Node, Fleet, GameState } from './types.js';

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
): Node {
  const n: Node = {
    id,
    x,
    y,
    owner,
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
    tn.troops -= f.count;
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
