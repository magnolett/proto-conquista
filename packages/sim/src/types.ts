import type { Owner, Difficulty, Config, BaseKind } from '@conquista/shared';

/**
 * Base (nó do grafo). Tudo que a sim precisa p/ economia, combate e IA.
 * `prod`/`cap`/`radius` são derivados do tier (espelham applyTier do game.js),
 * materializados aqui p/ a render não recalcular regra.
 */
export interface Node {
  readonly id: number;
  /** Posição no mundo lógico (worldW x worldH), não em pixels de tela. */
  x: number;
  y: number;
  owner: Owner;
  /** Especialidade da base (F2): normal/canhão/escudo/veloz. */
  kind: BaseKind;
  tier: number;
  troops: number;
  prod: number;
  cap: number;
  radius: number;
  /** Animação de captura/reforço (0..1), puramente cosmético mas vive na sim. */
  pulse: number;
  /** True se há frota inimiga a caminho neste frame (cosmético). */
  underAttack: boolean;
}

/** Frota em trânsito. */
export interface Fleet {
  readonly id: number;
  owner: Owner;
  x: number;
  y: number;
  /** Id do nó-alvo. */
  target: number;
  count: number;
  /** Multiplicador de velocidade herdado da base de origem (F2: 'veloz'). Ausente ⇒ 1. */
  speedMul?: number;
}

/** Zona modificadora de mapa (F2): multiplica a velocidade da frota dentro do raio. */
export interface Zone {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Multiplicador de velocidade: >1 estrada (acelera), <1 terreno (atrasa). */
  readonly speedMul: number;
}

/**
 * GameState — TODO o estado da simulação. Serializável e snapshotável.
 * Nenhuma referência a DOM/canvas. O PRNG vive aqui (`rng`) p/ reprodutibilidade.
 */
export interface GameState {
  nodes: Node[];
  fleets: Fleet[];
  /** Estado inteiro (uint32) do mulberry32. Avançado de forma pura no step. */
  rng: number;
  /** Seed original (p/ Shift+R / golden replay). */
  readonly seed: number;
  /** Tempo simulado acumulado (s). */
  time: number;
  /** Contador regressivo até o próximo tick da IA (s). */
  aiTimer: number;
  /** Dificuldade ativa (afeta os pesos da IA). */
  difficulty: Difficulty;
  gameOver: boolean;
  winner: Owner | null;
  /** Próximo id de frota (monotônico, p/ ids estáveis). */
  nextFleetId: number;
  /** Config de balanceamento usada nesta partida. */
  readonly config: Config;
  /** Zonas modificadoras de velocidade do mapa (F2). Ausente ⇒ sem modificadores. */
  zones?: Zone[];
}

/**
 * Ordem de envio do JOGADOR resolvida pelo input (a render NÃO toca no state):
 * envia `ratio` da guarnição de cada `sourceIds` p/ `targetId`.
 */
export interface SendOrder {
  readonly sourceIds: readonly number[];
  readonly targetId: number;
  readonly ratio: number;
}

/** Pedido de upgrade do jogador (tecla U sobre a seleção). */
export interface UpgradeOrder {
  readonly nodeId: number;
}

/**
 * Inputs do jogador para UM step. A sim é a verdade: a render só preenche isto.
 * `dt` é injetado separadamente em step(state, inputs, dt).
 */
export interface Inputs {
  readonly sends?: readonly SendOrder[];
  readonly upgrades?: readonly UpgradeOrder[];
}

/** Inputs vazios reutilizáveis. */
export const NO_INPUTS: Inputs = Object.freeze({});
