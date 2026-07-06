import { TIERS, upgradeCost, BASE_KINDS, SCORE, UPGRADE } from '@conquista/shared';
import type { BaseKind, Owner } from '@conquista/shared';
import type { Node, Fleet, GameState, Zone } from './types.js';

/**
 * Hipotenusa via sqrt — bit-determinística entre engines JS (IEEE-754 exige
 * arredondamento correto de sqrt; `Math.hypot` NÃO tem essa garantia e pode
 * divergir por ULPs entre V8/JSC/SpiderMonkey, o que quebraria replay/PvP
 * cross-machine). Coordenadas do jogo são pequenas: sem risco de overflow.
 */
export function hyp(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

/** Distância euclidiana entre dois pontos. */
export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return hyp(a.x - b.x, a.y - b.y);
}

/**
 * Comprimento do trecho do segmento (x1,y1)→(x2,y2) que fica DENTRO do círculo
 * (cx,cy,r). Puro e determinístico — usado pela IA p/ estimar o custo de cruzar
 * o alcance de um canhão (F2.5). Retorna 0 se não há interseção.
 */
export function segmentCircleChord(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  r: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 0) return 0; // segmento degenerado: sem comprimento
  const fx = x1 - cx;
  const fy = y1 - cy;
  const b = 2 * (fx * dx + fy * dy);
  const c0 = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * len2 * c0;
  if (disc <= 0) return 0;
  const sq = Math.sqrt(disc);
  const t1 = Math.max(0, Math.min(1, (-b - sq) / (2 * len2)));
  const t2 = Math.max(0, Math.min(1, (-b + sq) / (2 * len2)));
  return (t2 - t1) * Math.sqrt(len2);
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
 * Cria uma frota saindo da borda da base de origem rumo ao alvo — ou ao
 * `waypoint` (F2.5), quando a rota tem um ponto de passagem.
 * Espelha spawnFleet do game.js (posição inicial na borda do raio).
 * Muta `state` (push em fleets + incrementa nextFleetId).
 */
export function spawnFleet(
  state: GameState,
  sn: Node,
  tn: Node,
  owner: Fleet['owner'],
  count: number,
  waypoint?: { x: number; y: number },
): void {
  const aim = waypoint ?? tn;
  const dx = aim.x - sn.x;
  const dy = aim.y - sn.y;
  const d = hyp(dx, dy) || 1;
  state.fleets.push({
    id: state.nextFleetId++,
    owner,
    x: sn.x + (dx / d) * sn.radius,
    y: sn.y + (dy / d) * sn.radius,
    target: tn.id,
    count,
    speedMul: BASE_KINDS[sn.kind].fleetSpeedMul,
    waypoint: waypoint ? { x: waypoint.x, y: waypoint.y } : undefined,
  });
}

/**
 * Multiplicador EFETIVO de dano recebido por um nó (F2.5): o dmgTakenMul do kind,
 * mas durante uma obra a base está "aberta" — escudo perde a proteção (piso 1)
 * e o dano é amplificado por UPGRADE.vulnMul. Usada por resolveArrival E pela IA
 * (mesma regra p/ todos — a IA é honesta).
 */
export function effectiveDmgMul(n: Node): number {
  const base = BASE_KINDS[n.kind].dmgTakenMul;
  return n.upgrading ? Math.max(base, 1) * UPGRADE.vulnMul : base;
}

/**
 * Resolve a chegada de uma frota ao nó-alvo (espelha resolveArrival).
 * Mesma cor = reforço (soma, pode passar do cap). Cor diferente = ataque:
 * subtrai; se a defesa fica negativa, a base VIRA com o excedente.
 * F2.5: base em obra toma dano ampliado, e a captura CANCELA a obra.
 * Retorna o desfecho (o step usa p/ emitir FxEvent — F3).
 */
export function resolveArrival(f: Fleet, tn: Node): 'reinforced' | 'defended' | 'captured' {
  if (tn.owner === f.owner) {
    tn.troops += f.count;
    return 'reinforced';
  }
  const dmg = f.count * effectiveDmgMul(tn);
  tn.troops -= dmg;
  if (tn.troops < 0) {
    tn.owner = f.owner;
    tn.troops = -tn.troops;
    tn.pulse = 1;
    tn.upgrading = undefined; // obra em curso morre com a captura (investimento perdido)
    return 'captured';
  }
  tn.pulse = 0.5;
  return 'defended';
}

/**
 * INICIA a obra de upgrade de um nó, se possível (F2.5): paga o custo agora e
 * agenda a evolução (kind alvo opcional — ausente mantém o atual). Uma base só
 * sustenta UMA obra por vez. Com UPGRADE.timePerTier ≤ 0, aplica na hora
 * (regra antiga — dial neutro). Retorna true se a obra começou/aplicou.
 */
export function upgradeNode(n: Node, kind?: BaseKind): boolean {
  if (n.tier >= TIERS.length - 1) return false;
  if (n.upgrading) return false;
  const cost = upgradeCost(n.tier);
  if (n.troops < cost) return false;
  n.troops -= cost;
  const targetKind: BaseKind = kind ?? n.kind;
  const total = UPGRADE.timePerTier * (n.tier + 1);
  if (total <= 0) {
    n.tier++;
    n.kind = targetKind;
    applyTier(n);
    n.pulse = 1;
    return true;
  }
  n.upgrading = { kind: targetKind, remaining: total, total };
  return true;
}

/** Conclui a obra de um nó (F2.5): sobe o tier, aplica o kind escolhido. */
export function finishUpgrade(n: Node): void {
  if (!n.upgrading) return;
  n.tier++;
  n.kind = n.upgrading.kind;
  n.upgrading = undefined;
  applyTier(n);
  n.pulse = 1;
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
