import type { Owner, Difficulty, Config, BaseKind, AIPersona } from '@conquista/shared';

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
  /**
   * Obra de upgrade em andamento (F2.5): kind alvo + tempo restante/total.
   * Durante a obra: produção suspensa, canhão inativo, dano recebido ×UPGRADE.vulnMul.
   * Captura cancela a obra (investimento perdido). Ausente ⇒ sem obra.
   */
  upgrading?: { kind: BaseKind; remaining: number; total: number } | undefined;
  /** Fortaleza central (F2.5): segurá-la por CORE.holdSeconds vence por DOMÍNIO. */
  isCore?: boolean;
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
  /**
   * Ponto de passagem (F2.5): a frota voa primeiro até aqui, depois ao alvo —
   * rota vira DECISÃO (flanquear canhão/lamaçal). Limpo ao ser alcançado.
   */
  waypoint?: { x: number; y: number } | undefined;
}

/**
 * Evento efêmero produzido por UM step (F2.5/F3): a apresentação desenha/soa,
 * a sim limpa e repõe a cada passo. É DADO de simulação (o que aconteceu), não regra.
 */
export interface FxEvent {
  readonly kind: 'engage' | 'capture' | 'upgraded';
  readonly x: number;
  readonly y: number;
  /** Quem protagonizou (capturou/terminou a obra). Ausente p/ 'engage'. */
  readonly owner?: Owner;
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
  /** Persona da IA nesta partida (F2.5): sorteada por seed; modula DIFFICULTY. */
  persona: AIPersona;
  gameOver: boolean;
  winner: Owner | null;
  /** Próximo id de frota (monotônico, p/ ids estáveis). */
  nextFleetId: number;
  /** Config de balanceamento usada nesta partida. */
  readonly config: Config;
  /** Zonas modificadoras de velocidade do mapa (F2). Ausente ⇒ sem modificadores. */
  zones?: Zone[];
  /** Eventos visuais do ÚLTIMO step (F2.5): limpo e repovoado a cada passo. */
  fx: FxEvent[];
  /** Progresso do DOMÍNIO do centro (F2.5): quem segura a fortaleza e há quanto tempo. */
  coreHold: { owner: Owner | null; held: number };
  /** Como a partida terminou (null enquanto roda). */
  winReason: 'elimination' | 'core' | null;
}

/**
 * Ordem de envio do JOGADOR resolvida pelo input (a render NÃO toca no state):
 * envia `ratio` da guarnição de cada `sourceIds` p/ `targetId`.
 */
export interface SendOrder {
  readonly sourceIds: readonly number[];
  readonly targetId: number;
  readonly ratio: number;
  /** Ponto de passagem opcional (F2.5): Shift durante o arrasto fixa o desvio. */
  readonly waypoint?: { readonly x: number; readonly y: number };
}

/** Pedido de upgrade do jogador (U mantém o kind; Z/X/C especializam — F2.5). */
export interface UpgradeOrder {
  readonly nodeId: number;
  /** Especialidade escolhida p/ quando a obra terminar. Ausente ⇒ mantém o kind atual. */
  readonly kind?: BaseKind;
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
