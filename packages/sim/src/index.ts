import { CFG, BASE_KINDS, ENGAGE, PERSONA_ORDER, CORE, NEUTRAL, SUPPLY } from '@conquista/shared';
import type { Config, Difficulty, AIPersona } from '@conquista/shared';
import type { GameState, Node, Inputs } from './types.js';
import { NO_INPUTS } from './types.js';
import { seedToState, nextRng } from './prng.js';
import { generateMap } from './mapgen.js';
import { resolveArrival, spawnFleet, upgradeNode, finishUpgrade, zoneMulAt, hyp } from './helpers.js';
import { aiThink, effectiveAI } from './ai.js';

export type {
  Node,
  Fleet,
  GameState,
  Inputs,
  SendOrder,
  UpgradeOrder,
  Zone,
  FxEvent,
} from './types.js';
export { NO_INPUTS } from './types.js';
export { mulberry32, nextRng, seedToState } from './prng.js';
export { generateMap } from './mapgen.js';
export {
  dist,
  hyp,
  applyTier,
  mkNode,
  spawnFleet,
  resolveArrival,
  upgradeNode,
  finishUpgrade,
  effectiveDmgMul,
  segmentCircleChord,
  zoneMulAt,
  visibleNodeIds,
  computeScore,
} from './helpers.js';
export { aiThink, effectiveAI } from './ai.js';

/** Opções de criação da partida. */
export interface CreateOptions {
  readonly difficulty?: Difficulty;
  readonly config?: Config;
  /**
   * Persona da IA (F2.5). Ausente ⇒ sorteada por seed (easy é sempre 'balanced').
   * Nota: fixar a persona pula um saque do PRNG — replays devem fixar a MESMA opção.
   */
  readonly persona?: AIPersona;
}

/**
 * Cria o estado inicial determinístico a partir de uma seed.
 * Mesma seed (+ mesmas opções) ⇒ mesmo mapa e mesma persona, sempre.
 */
export function createInitialState(seed: number, opts: CreateOptions = {}): GameState {
  const config = opts.config ?? CFG;
  const difficulty: Difficulty = opts.difficulty ?? 'normal';
  const map = generateMap(seedToState(seed), config);
  const { nodes, zones } = map;
  let rng = map.rng;
  // Persona da IA (F2.5): sorteio determinístico pós-mapa; easy fica previsível.
  let persona: AIPersona = opts.persona ?? 'balanced';
  if (opts.persona === undefined && difficulty !== 'easy') {
    const r = nextRng(rng);
    rng = r.state;
    persona = PERSONA_ORDER[Math.floor(r.value * PERSONA_ORDER.length)]!;
  }
  return {
    nodes,
    fleets: [],
    rng,
    seed,
    time: 0,
    aiTimer: 0,
    difficulty,
    persona,
    gameOver: false,
    winner: null,
    nextFleetId: 0,
    config,
    zones,
    fx: [],
    coreHold: { owner: null, held: 0 },
    winReason: null,
  };
}

/**
 * Aplica as ordens do JOGADOR resolvidas pelo input (sends + upgrades).
 * A render apenas preenche `Inputs`; a regra mora aqui (porte de sendFrom/upgradeNode).
 */
function applyInputs(state: GameState, inputs: Inputs): void {
  const nodes = state.nodes;

  for (const order of inputs.sends ?? []) {
    const tn = nodes[order.targetId];
    if (!tn) continue;
    for (const sid of order.sourceIds) {
      if (sid === order.targetId) continue;
      const sn = nodes[sid];
      if (!sn || sn.owner !== 'you') continue;
      const count = Math.floor(sn.troops * order.ratio);
      if (count < 1) continue;
      sn.troops -= count;
      spawnFleet(state, sn, tn, 'you', count, order.waypoint);
    }
  }

  for (const order of inputs.upgrades ?? []) {
    const n = nodes[order.nodeId];
    if (n && n.owner === 'you') upgradeNode(n, order.kind);
  }
}

/** Verifica vitória/derrota (porte de checkWin). */
function checkWin(state: GameState): void {
  if (state.gameOver) return;
  const youHas =
    state.nodes.some((n) => n.owner === 'you') || state.fleets.some((f) => f.owner === 'you');
  const enHas =
    state.nodes.some((n) => n.owner === 'enemy') || state.fleets.some((f) => f.owner === 'enemy');
  if (!enHas) {
    state.gameOver = true;
    state.winner = 'you';
    state.winReason = 'elimination';
  } else if (!youHas) {
    state.gameOver = true;
    state.winner = 'enemy';
    state.winReason = 'elimination';
  }
}

/**
 * Avança a simulação UM passo de `dt` segundos, aplicando `inputs` do jogador.
 *
 * Função (quase) pura sobre o State: dado (state, inputs, dt) o resultado é
 * determinístico — nenhuma fonte de não-determinismo (sem Math.random/Date.now).
 * Por performance, MUTA e retorna o próprio `state` (o chamador que queira
 * snapshot deve clonar antes; ver os testes de golden replay).
 *
 * Ordem (espelha update(dt) do game.js):
 *  0. inputs do jogador (envios/upgrades)
 *  1. economia (produção até cap; neutras estáticas) + decaimento de pulse
 *  2. movimento de frotas + combate na chegada
 *  3. flag underAttack
 *  4. tick da IA (aiTimer regressivo; D.aiTick recarrega)
 *  5. vitória/derrota
 */
export function step(state: GameState, inputs: Inputs = NO_INPUTS, dt: number): GameState {
  if (state.gameOver) {
    // Partida acabada: estado congela (mesma semântica do game.js, que pausa o update).
    return state;
  }

  state.fx.length = 0; // eventos visuais valem por UM step

  applyInputs(state, inputs);

  state.time += dt;

  // 1) Economia + pulse + obras (F2.5: base em obra NÃO produz; obra avança e conclui).
  for (const n of state.nodes) {
    n.underAttack = false;
    if (n.pulse > 0) n.pulse = Math.max(0, n.pulse - dt * 1.5);
    if (n.upgrading) {
      n.upgrading.remaining -= dt;
      if (n.upgrading.remaining <= 0) {
        finishUpgrade(n);
        state.fx.push({ kind: 'upgraded', x: n.x, y: n.y, owner: n.owner });
      }
    } else if (n.owner !== 'neutral' && n.troops < n.cap) {
      n.troops = Math.min(n.cap, n.troops + n.prod * dt);
    } else if (n.owner === 'neutral' && NEUTRAL.growthRate > 0) {
      // F2.5: neutras engordam devagar até min(cap, growthCap) — esperar custa.
      const ceil = Math.min(n.cap, NEUTRAL.growthCap);
      if (n.troops < ceil) n.troops = Math.min(ceil, n.troops + NEUTRAL.growthRate * dt);
    }
  }

  // 1.5) Canhões (F2): bases-canhão afinam frotas de OUTRO dono dentro do alcance.
  //      'normal' tem cannonRange 0 ⇒ este passo é inerte sem canhões (golden intacto).
  //      F2.5: canhão em obra fica inativo (a vulnerabilidade é real).
  let hasCannon = false;
  for (const n of state.nodes) {
    if (n.upgrading) continue;
    const k = BASE_KINDS[n.kind];
    if (k.cannonRange <= 0) continue;
    hasCannon = true;
    const r2 = k.cannonRange * k.cannonRange;
    for (const f of state.fleets) {
      if (f.owner === n.owner) continue;
      const dx = f.x - n.x;
      const dy = f.y - n.y;
      if (dx * dx + dy * dy <= r2) f.count -= k.cannonDps * dt;
    }
  }
  if (hasCannon) state.fleets = state.fleets.filter((f) => f.count > 0);

  // 2) Movimento de frotas + combate na chegada. Velocidade EFETIVA por frota:
  //    fleetSpeed × speedMul (base 'veloz') × zonas do mapa. F2.5: com waypoint,
  //    a frota voa primeiro até ele (rota é decisão), depois segue ao alvo.
  const survivors: GameState['fleets'] = [];
  for (const f of state.fleets) {
    const tn = state.nodes[f.target];
    if (!tn) continue; // alvo inexistente: descarta a frota (defensivo).
    const aim = f.waypoint ?? tn;
    const dx = aim.x - f.x;
    const dy = aim.y - f.y;
    const d = hyp(dx, dy) || 0.0001;
    const stepLen =
      state.config.fleetSpeed * (f.speedMul ?? 1) * zoneMulAt(f.x, f.y, state.zones) * dt;
    if (f.waypoint) {
      if (d <= stepLen + 2) {
        f.x = f.waypoint.x;
        f.y = f.waypoint.y;
        f.waypoint = undefined; // ponto de passagem atingido: agora ruma ao alvo
      } else {
        f.x += (dx / d) * stepLen;
        f.y += (dy / d) * stepLen;
      }
      survivors.push(f);
    } else if (d <= stepLen + tn.radius * 0.4) {
      if (resolveArrival(f, tn) === 'captured') {
        state.fx.push({ kind: 'capture', x: tn.x, y: tn.y, owner: tn.owner });
      }
    } else {
      f.x += (dx / d) * stepLen;
      f.y += (dy / d) * stepLen;
      survivors.push(f);
    }
  }
  state.fleets = survivors;

  // 2.55) Atrito de suprimento (F2.5): frota longe de QUALQUER base do próprio dono
  //       definha (attritionPerSec) e morre abaixo de 1 tropa. Frota neutra é imune
  //       (não há logística neutra; também preserva os cenários de conservação).
  if (SUPPLY.attritionPerSec > 0) {
    const r2 = SUPPLY.range * SUPPLY.range;
    let starved = false;
    for (const f of state.fleets) {
      if (f.owner === 'neutral') continue;
      let supplied = false;
      for (const n of state.nodes) {
        if (n.owner !== f.owner) continue;
        const dx = f.x - n.x;
        const dy = f.y - n.y;
        if (dx * dx + dy * dy <= r2) {
          supplied = true;
          break;
        }
      }
      if (!supplied) {
        f.count -= f.count * SUPPLY.attritionPerSec * dt;
        if (f.count < 1) {
          f.count = 0;
          starved = true;
        }
      }
    }
    if (starved) state.fleets = state.fleets.filter((f) => f.count > 0);
  }

  // 2.6) Interceptação (F2.5): frotas de donos DIFERENTES que se cruzam brigam no ar —
  //      a menor morre, a maior segue com a diferença (aritmética da chegada, no céu).
  //      Ordem i<j sobre o array de frotas (ids de spawn) ⇒ determinístico.
  //      ENGAGE.radius 0 ⇒ fase inerte (regra antiga).
  if (ENGAGE.radius > 0 && state.fleets.length > 1) {
    const r2 = ENGAGE.radius * ENGAGE.radius;
    const fs = state.fleets;
    let killed = false;
    for (let i = 0; i < fs.length; i++) {
      const a = fs[i]!;
      if (a.count <= 0) continue;
      for (let j = i + 1; j < fs.length; j++) {
        const b = fs[j]!;
        if (b.count <= 0 || b.owner === a.owner) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        if (dx * dx + dy * dy > r2) continue;
        state.fx.push({ kind: 'engage', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        killed = true;
        if (a.count > b.count) {
          a.count -= b.count;
          b.count = 0; // a segue no loop: pode engajar a próxima no caminho
        } else if (b.count > a.count) {
          b.count -= a.count;
          a.count = 0;
          break; // a morreu: não briga mais neste step
        } else {
          a.count = 0;
          b.count = 0;
          break;
        }
      }
    }
    if (killed) state.fleets = fs.filter((f) => f.count > 0);
  }

  // 3) underAttack: frota inimiga (qualquer dono ≠ do nó) a caminho.
  for (const f of state.fleets) {
    const tn = state.nodes[f.target];
    if (tn && tn.owner !== f.owner) tn.underAttack = true;
  }

  // 4) IA por ticks. aiTick vem da dificuldade MODULADA pela persona (F2.5).
  state.aiTimer -= dt;
  if (state.aiTimer <= 0) {
    state.aiTimer = effectiveAI(state.difficulty, state.persona).aiTick;
    aiThink(state);
  }

  // 4.5) DOMÍNIO do centro (F2.5): segurar a fortaleza por holdSeconds contínuos vence.
  if (CORE.holdSeconds > 0 && !state.gameOver) {
    const core = state.nodes.find((n) => n.isCore);
    if (core && (core.owner === 'you' || core.owner === 'enemy')) {
      if (state.coreHold.owner === core.owner) {
        state.coreHold.held += dt;
        if (state.coreHold.held >= CORE.holdSeconds) {
          state.gameOver = true;
          state.winner = core.owner;
          state.winReason = 'core';
        }
      } else {
        state.coreHold.owner = core.owner; // trocou de mãos: recomeça a contagem
        state.coreHold.held = dt;
      }
    } else if (state.coreHold.owner !== null) {
      state.coreHold.owner = null;
      state.coreHold.held = 0;
    }
  }

  // 5) Vitória/derrota.
  checkWin(state);

  return state;
}

/** Clona profundamente um GameState (p/ snapshots de teste e replays). */
export function cloneState(state: GameState): GameState {
  return {
    nodes: state.nodes.map((n) => ({
      ...n,
      upgrading: n.upgrading ? { ...n.upgrading } : undefined,
    })),
    fleets: state.fleets.map((f) => ({
      ...f,
      waypoint: f.waypoint ? { ...f.waypoint } : undefined,
    })),
    rng: state.rng,
    seed: state.seed,
    time: state.time,
    aiTimer: state.aiTimer,
    difficulty: state.difficulty,
    persona: state.persona,
    gameOver: state.gameOver,
    winner: state.winner,
    nextFleetId: state.nextFleetId,
    config: state.config,
    zones: state.zones ? state.zones.map((z) => ({ ...z })) : undefined,
    fx: state.fx.map((e) => ({ ...e })),
    coreHold: { ...state.coreHold },
    winReason: state.winReason,
  };
}
