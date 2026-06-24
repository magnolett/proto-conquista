import { CFG, DIFFICULTY } from '@conquista/shared';
import type { Config, Difficulty } from '@conquista/shared';
import type { GameState, Node, Inputs } from './types.js';
import { NO_INPUTS } from './types.js';
import { seedToState } from './prng.js';
import { generateMap } from './mapgen.js';
import { resolveArrival, spawnFleet, upgradeNode } from './helpers.js';
import { aiThink } from './ai.js';

export type {
  Node,
  Fleet,
  GameState,
  Inputs,
  SendOrder,
  UpgradeOrder,
} from './types.js';
export { NO_INPUTS } from './types.js';
export { mulberry32, nextRng, seedToState } from './prng.js';
export { generateMap } from './mapgen.js';
export {
  dist,
  applyTier,
  mkNode,
  spawnFleet,
  resolveArrival,
  upgradeNode,
} from './helpers.js';
export { aiThink } from './ai.js';

/** Opções de criação da partida. */
export interface CreateOptions {
  readonly difficulty?: Difficulty;
  readonly config?: Config;
}

/**
 * Cria o estado inicial determinístico a partir de uma seed.
 * Mesma seed (+ mesma config) ⇒ mesmo mapa, sempre.
 */
export function createInitialState(seed: number, opts: CreateOptions = {}): GameState {
  const config = opts.config ?? CFG;
  const difficulty: Difficulty = opts.difficulty ?? 'normal';
  const { nodes, rng } = generateMap(seedToState(seed), config);
  return {
    nodes,
    fleets: [],
    rng,
    seed,
    time: 0,
    aiTimer: 0,
    difficulty,
    gameOver: false,
    winner: null,
    nextFleetId: 0,
    config,
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
      spawnFleet(state, sn, tn, 'you', count);
    }
  }

  for (const order of inputs.upgrades ?? []) {
    const n = nodes[order.nodeId];
    if (n && n.owner === 'you') upgradeNode(n);
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
  } else if (!youHas) {
    state.gameOver = true;
    state.winner = 'enemy';
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

  applyInputs(state, inputs);

  state.time += dt;

  // 1) Economia + pulse.
  for (const n of state.nodes) {
    n.underAttack = false;
    if (n.pulse > 0) n.pulse = Math.max(0, n.pulse - dt * 1.5);
    if (n.owner !== 'neutral' && n.troops < n.cap) {
      n.troops = Math.min(n.cap, n.troops + n.prod * dt);
    }
  }

  // 2) Movimento de frotas + combate na chegada.
  const speed = state.config.fleetSpeed;
  const survivors: GameState['fleets'] = [];
  for (const f of state.fleets) {
    const tn = state.nodes[f.target];
    if (!tn) continue; // alvo inexistente: descarta a frota (defensivo).
    const dx = tn.x - f.x;
    const dy = tn.y - f.y;
    const d = Math.hypot(dx, dy) || 0.0001;
    const stepLen = speed * dt;
    if (d <= stepLen + tn.radius * 0.4) {
      resolveArrival(f, tn);
    } else {
      f.x += (dx / d) * stepLen;
      f.y += (dy / d) * stepLen;
      survivors.push(f);
    }
  }
  state.fleets = survivors;

  // 3) underAttack: frota inimiga (qualquer dono ≠ do nó) a caminho.
  for (const f of state.fleets) {
    const tn = state.nodes[f.target];
    if (tn && tn.owner !== f.owner) tn.underAttack = true;
  }

  // 4) IA por ticks. aiTick vem da dificuldade.
  state.aiTimer -= dt;
  if (state.aiTimer <= 0) {
    state.aiTimer = DIFFICULTY[state.difficulty].aiTick;
    aiThink(state);
  }

  // 5) Vitória/derrota.
  checkWin(state);

  return state;
}

/** Clona profundamente um GameState (p/ snapshots de teste e replays). */
export function cloneState(state: GameState): GameState {
  return {
    nodes: state.nodes.map((n) => ({ ...n })),
    fleets: state.fleets.map((f) => ({ ...f })),
    rng: state.rng,
    seed: state.seed,
    time: state.time,
    aiTimer: state.aiTimer,
    difficulty: state.difficulty,
    gameOver: state.gameOver,
    winner: state.winner,
    nextFleetId: state.nextFleetId,
    config: state.config,
  };
}
