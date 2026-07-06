import { DIFFICULTY, PERSONAS, AI_TUNING, BASE_KINDS, SUPPLY, upgradeCost } from '@conquista/shared';
import type { BaseKind, Difficulty, AIPersona } from '@conquista/shared';
import type { GameState, Node } from './types.js';
import { dist, hyp, spawnFleet, upgradeNode, effectiveDmgMul, segmentCircleChord } from './helpers.js';
import { nextRng } from './prng.js';

/** Lado jogável pela IA (self-play usa 'you'; o jogo real usa o default 'enemy'). */
export type AISide = 'enemy' | 'you';

/** Parâmetros EFETIVOS da IA: DIFFICULTY modulada pela persona (F2.5). */
export interface EffectiveAI {
  readonly aiTick: number;
  readonly expandThresh: number;
  readonly expandForce: number;
  readonly tierW: number;
  readonly distW: number;
  readonly antiPlayerW: number;
  readonly upgradeChance: number;
  readonly defendThresh: number;
  readonly coordinated: boolean;
}

/** Combina dificuldade × persona nos pesos finais. Pura e determinística. */
export function effectiveAI(difficulty: Difficulty, persona: AIPersona): EffectiveAI {
  const D = DIFFICULTY[difficulty];
  const P = PERSONAS[persona];
  return {
    aiTick: D.aiTick * P.aiTickMul,
    expandThresh: D.expandThresh * P.expandThreshMul,
    expandForce: Math.min(0.95, D.expandForce * P.expandForceMul),
    tierW: D.tierW,
    distW: D.distW,
    antiPlayerW: D.antiPlayerW * P.antiPlayerWMul,
    upgradeChance: Math.min(0.9, D.upgradeChance * P.upgradeChanceMul),
    defendThresh: AI_TUNING.defendThresh * P.defendThreshMul,
    // hard sempre sabe coordenar; nas demais dificuldades depende da persona.
    coordinated: P.coordinated || difficulty === 'hard',
  };
}

/**
 * Custo estimado (em tropas) de uma frota do lado `owner` cruzar canhões HOSTIS
 * na rota reta from→to: tempo exposto × dps de cada canhão que a rota atravessa.
 * Aproximação honesta (ignora zonas de velocidade) sobre dados públicos.
 */
function cannonRouteCost(state: GameState, from: Node, to: Node, owner: AISide): number {
  let cost = 0;
  const speed = state.config.fleetSpeed * BASE_KINDS[from.kind].fleetSpeedMul;
  if (speed <= 0) return 0;
  for (const c of state.nodes) {
    if (c.owner === owner) continue; // canhão do próprio lado não o fere
    if (c.upgrading) continue; // canhão em obra está inativo
    const k = BASE_KINDS[c.kind];
    if (k.cannonRange <= 0 || k.cannonDps <= 0) continue;
    const chord = segmentCircleChord(from.x, from.y, to.x, to.y, c.x, c.y, k.cannonRange);
    if (chord > 0) cost += (chord / speed) * k.cannonDps;
  }
  return cost;
}

/** Score de um alvo p/ um atacante (compartilhado pelo ataque individual e pelo all-in). */
function targetScore(
  state: GameState,
  E: EffectiveAI,
  from: Node,
  t: Node,
  owner: AISide,
  foe: AISide,
): number {
  return (
    t.tier * E.tierW -
    t.troops -
    dist(from, t) * E.distW +
    (t.owner === foe ? E.antiPlayerW : 0) +
    (t.isCore ? AI_TUNING.coreW : 0) + // o centro vale a briga (vitória por domínio)
    (t.upgrading ? AI_TUNING.buildTargetW : 0) - // punir greed: base em obra é alvo de ouro
    cannonRouteCost(state, from, t, owner) * AI_TUNING.cannonAvoidW - // rota sob canhão custa caro
    Math.max(0, dist(from, t) - SUPPLY.range) * AI_TUNING.supplyAvoidW // rota além do suprimento definha
  );
}

/**
 * Ponto de desvio p/ flanquear o PRIMEIRO canhão hostil que a rota reta cruza
 * (F2.5): empurra o waypoint perpendicular à rota, para fora do alcance com
 * margem. Retorna undefined quando a rota está limpa. Determinística.
 */
function avoidCannonWaypoint(
  state: GameState,
  from: Node,
  to: Node,
  owner: AISide,
): { x: number; y: number } | undefined {
  for (const c of state.nodes) {
    if (c.owner === owner || c.upgrading) continue;
    const k = BASE_KINDS[c.kind];
    if (k.cannonRange <= 0 || k.cannonDps <= 0) continue;
    if (segmentCircleChord(from.x, from.y, to.x, to.y, c.x, c.y, k.cannonRange) <= 0) continue;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len2 = dx * dx + dy * dy;
    if (len2 <= 0) return undefined;
    // ponto da rota mais próximo do canhão, empurrado perpendicular p/ fora do alcance
    let t = ((c.x - from.x) * dx + (c.y - from.y) * dy) / len2;
    t = Math.max(0.1, Math.min(0.9, t));
    const px = from.x + dx * t;
    const py = from.y + dy * t;
    let nx = px - c.x;
    let ny = py - c.y;
    const nd = hyp(nx, ny);
    if (nd < 1e-6) {
      const len = Math.sqrt(len2);
      nx = -dy / len; // canhão exatamente na rota: desvia pela normal do segmento
      ny = dx / len;
    } else {
      nx /= nd;
      ny /= nd;
    }
    const margin = k.cannonRange * 1.25;
    return {
      x: Math.max(20, Math.min(state.config.worldW - 20, c.x + nx * margin)),
      y: Math.max(20, Math.min(state.config.worldH - 20, c.y + ny * margin)),
    };
  }
  return undefined;
}

/**
 * IA (aiThink) — joga pelas MESMAS regras do jogador (só lê estado público) e é
 * determinística: todo "acaso" vem do PRNG guardado no state. Muta `state`
 * (frotas, upgrades, state.rng). Pesos = DIFFICULTY × PERSONA (F2.5).
 *
 * `owner` permite SELF-PLAY (balance harness joga com os dois lados); o jogo
 * real usa o default 'enemy'. `personaOverride` idem (o state guarda a persona
 * do lado 'enemy'; o lado espelhado passa a sua).
 *
 * Etapas:
 *  1) DEFESA: base ameaçada puxa reforço do vizinho forte mais próximo.
 *  2) ATAQUE/EXPANSÃO: com o FIX da superinvestida (committed[]) — várias bases
 *     do lado não despejam todas no mesmo alvo já garantido.
 *  2.5) ALL-IN coordenado (persona/hard): se NINGUÉM pôde atacar sozinho, as
 *     bases com excedente somam forças contra o melhor alvo tomável pela SOMA.
 *  3) ECONOMIA: com prng < upgradeChance, inicia OBRA numa base segura,
 *     escolhendo a especialização pela posição.
 */
export function aiThink(
  state: GameState,
  owner: AISide = 'enemy',
  personaOverride?: AIPersona,
): void {
  const E = effectiveAI(state.difficulty, personaOverride ?? state.persona);
  const foe: AISide = owner === 'enemy' ? 'you' : 'enemy';
  const nodes = state.nodes;
  const mine = nodes.filter((n) => n.owner === owner);
  if (mine.length === 0) return;

  // Ameaça percebida: tropas do ADVERSÁRIO a caminho de cada base do lado.
  const incoming: Record<number, number> = {};
  for (const f of state.fleets) {
    if (f.owner === foe) {
      const t = nodes[f.target];
      if (t && t.owner === owner) incoming[t.id] = (incoming[t.id] ?? 0) + f.count;
    }
  }

  // 1) DEFESA — reforço do vizinho forte mais próximo (limiar por persona).
  for (const n of mine) {
    if ((incoming[n.id] ?? 0) > n.troops * E.defendThresh) {
      const helper = mine
        .filter((m) => m.id !== n.id && m.troops > 16)
        .sort((a, b) => dist(a, n) - dist(b, n))[0];
      if (helper) {
        const c = Math.floor(helper.troops * AI_TUNING.helperDrain);
        if (c >= 1) {
          helper.troops -= c;
          spawnFleet(state, helper, n, owner, c);
        }
      }
    }
  }

  // FIX da superinvestida: committed[id] = soma de count das frotas do lado já
  // mirando cada nó (inclui os reforços defensivos recém-criados acima).
  const committed: Record<number, number> = {};
  for (const f of state.fleets) {
    if (f.owner === owner) committed[f.target] = (committed[f.target] ?? 0) + f.count;
  }

  // 2) ATAQUE/EXPANSÃO — atacantes com excedente miram o melhor alvo tomável.
  const attackers = mine
    .filter((n) => n.troops > n.cap * E.expandThresh)
    .sort((a, b) => b.troops - a.troops);

  let attacked = false;
  for (const a of attackers) {
    const force = Math.floor(a.troops * E.expandForce);
    let best: Node | null = null;
    let bestScore = -Infinity;
    for (const t of nodes) {
      if (t.owner === owner) continue;
      // Defesa EFETIVA em unidades de count: escudo exige proporcionalmente mais;
      // base em OBRA (F2.5) toma dano ampliado ⇒ exige menos.
      const effDef = t.troops / effectiveDmgMul(t);
      const already = committed[t.id] ?? 0;
      if (already > effDef) continue; // já será capturado pelo que está a caminho — não empilhar
      const needed = effDef - already;
      if (force <= needed + 1) continue; // só ataca o que AINDA consegue tomar
      const score = targetScore(state, E, a, t, owner, foe);
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    if (best) {
      const c = Math.floor(a.troops * E.expandForce);
      a.troops -= c;
      spawnFleet(state, a, best, owner, c, avoidCannonWaypoint(state, a, best, owner));
      committed[best.id] = (committed[best.id] ?? 0) + c; // reserva o alvo
      attacked = true;
    }
  }

  // 2.5) ALL-IN coordenado (F2.5): nenhum alvo tomável SOZINHO ⇒ tomável pela SOMA.
  //      Destrava a incapacidade estrutural antiga: fronteira empilhada do rival
  //      deixa de ser eternamente segura contra personas coordenadas.
  if (!attacked && E.coordinated && attackers.length >= 2) {
    const lead = attackers[0]!;
    const pool = attackers.reduce((acc, a) => acc + Math.floor(a.troops * E.expandForce), 0);
    let best: Node | null = null;
    let bestScore = -Infinity;
    for (const t of nodes) {
      if (t.owner === owner) continue;
      const effDef = t.troops / effectiveDmgMul(t);
      const already = committed[t.id] ?? 0;
      if (already > effDef) continue;
      if (pool <= effDef - already + 1) continue; // nem juntas dá — não suicida
      const score = targetScore(state, E, lead, t, owner, foe);
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    if (best) {
      for (const a of attackers) {
        const c = Math.floor(a.troops * E.expandForce);
        if (c < 1) continue;
        a.troops -= c;
        spawnFleet(state, a, best, owner, c, avoidCannonWaypoint(state, a, best, owner));
      }
    }
  }

  // 3) ECONOMIA — prng < upgradeChance: OBRA numa base segura (F2.5: upgrade é
  //    vulnerável ⇒ nunca sob ameaça nem em dobro), com especialização posicional.
  const roll = nextRng(state.rng);
  state.rng = roll.state;
  if (roll.value < E.upgradeChance) {
    const safe = mine
      .filter(
        (n) => n.troops >= upgradeCost(n.tier) && !((incoming[n.id] ?? 0) > 0) && !n.upgrading,
      )
      .sort((a, b) => a.tier - b.tier)[0];
    if (safe) upgradeNode(safe, chooseUpgradeKind(state, safe, foe));
  }
}

/**
 * Especialização que a IA escolhe ao evoluir uma base (F2.5) — determinística e
 * posicional: base já especial mantém a vocação; perto do CENTRO vira canhão
 * (pressão de área na zona contestada); na FRONTEIRA com o rival vira escudo;
 * na retaguarda vira veloz (reforço chega rápido).
 */
function chooseUpgradeKind(state: GameState, n: Node, foe: AISide): BaseKind {
  if (n.kind !== 'normal') return n.kind;
  const w = state.config.worldW;
  const center = { x: w / 2, y: state.config.worldH / 2 };
  if (dist(n, center) < w * 0.22) return 'cannon';
  const foes = state.nodes.filter((m) => m.owner === foe);
  if (foes.length === 0) return 'fast';
  let dFoe = Infinity;
  for (const m of foes) dFoe = Math.min(dFoe, dist(n, m));
  return dFoe < w * 0.42 ? 'shield' : 'fast';
}
