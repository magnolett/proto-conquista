import type {
  Config,
  TierConfig,
  Difficulty,
  DifficultyConfig,
  BaseKind,
  BaseKindConfig,
  AIPersona,
  PersonaConfig,
  DoctrineId,
  DoctrineConfig,
} from './types.js';

/**
 * CFG base — "diais" de balanceamento.
 * worldW/worldH definem o mundo LÓGICO da sim (a render escala p/ a tela).
 * O protótipo single-file usava innerWidth/innerHeight; fixamos aqui p/ determinismo.
 */
export const CFG: Config = {
  // 150 (era 135): o mundo 4× maior (F5-lite) alonga as travessias; +11% de
  // velocidade mantém o ritmo sem matar a geometria.
  fleetSpeed: 150,
  sendDefault: 0.5,
  // 2560×1440 (era 1280×720): mapa "consideravelmente maior" — jogável via
  // câmera (zoom/pan) + minimapa no cliente.
  worldW: 2560,
  worldH: 1440,
};

/** Tiers de base (T1, T2, T3). */
export const TIERS: readonly TierConfig[] = [
  { prod: 1.0, cap: 30, r: 20 }, // T1
  { prod: 1.9, cap: 58, r: 27 }, // T2
  { prod: 3.2, cap: 95, r: 34 }, // T3
];

/**
 * BASE_KINDS — especialidades de base (F2). 'normal' é neutro (sem efeito).
 * Distinguidas por forma+cor na render (zero asset). Números provisórios:
 * calibrar no playtest (os campos são mutáveis, como TIERS).
 */
export const BASE_KINDS: Readonly<Record<BaseKind, BaseKindConfig>> = {
  normal: { label: 'Normal', dmgTakenMul: 1.0, fleetSpeedMul: 1.0, cannonRange: 0, cannonDps: 0 },
  shield: { label: 'Escudo', dmgTakenMul: 0.6, fleetSpeedMul: 1.0, cannonRange: 0, cannonDps: 0 },
  fast: { label: 'Veloz', dmgTakenMul: 1.0, fleetSpeedMul: 1.6, cannonRange: 0, cannonDps: 0 },
  cannon: { label: 'Canhão', dmgTakenMul: 1.0, fleetSpeedMul: 1.0, cannonRange: 110, cannonDps: 6 },
};

/**
 * DIFFICULTY — pesos por dificuldade. (O "contrato de costuras" era da era
 * multi-frente do F0; hoje são diais de calibração como os demais.)
 */
export const DIFFICULTY: Readonly<Record<Difficulty, DifficultyConfig>> = {
  easy: {
    label: 'Fácil',
    // aiTick 1.4 / upgradeChance 0.15 (eram 1.1/0.2): self-play dava hard×easy
    // ~60% — contraste de dificuldade fraco; o fácil agora pensa bem mais
    // devagar (também melhora o onboarding humano). balance-report 2026-07-06.
    // distW reduzido ~40% (F5-lite): distâncias dobraram com o mundo 4×.
    aiTick: 1.4,
    expandThresh: 0.75,
    expandForce: 0.55,
    tierW: 35,
    distW: 0.12,
    antiPlayerW: 10,
    upgradeChance: 0.15,
  },
  normal: {
    label: 'Normal',
    aiTick: 0.7,
    expandThresh: 0.6,
    expandForce: 0.6,
    tierW: 45,
    distW: 0.09,
    antiPlayerW: 25,
    upgradeChance: 0.35,
  },
  hard: {
    label: 'Difícil',
    aiTick: 0.45,
    expandThresh: 0.55,
    expandForce: 0.65,
    tierW: 55,
    distW: 0.07,
    antiPlayerW: 40,
    upgradeChance: 0.5,
  },
};

/** Ordem canônica p/ ciclar dificuldade (tecla G). */
export const DIFFICULTY_ORDER: readonly Difficulty[] = ['easy', 'normal', 'hard'];

/**
 * MAP_MODS — modificadores de mapa (F2): zonas que multiplicam a velocidade da frota.
 * Estrada acelera (>1), terreno/lamaçal atrasa (<1). Mutável: diais de playtest.
 */
export const MAP_MODS = {
  roadSpeedMul: 1.5,
  mudSpeedMul: 0.6,
  // raios +50% (F5-lite): zonas precisam pesar no mundo 4×.
  roadRadius: 150,
  mudRadius: 135,
};

/** Pesos do placar (F2): pontuação = bases*baseW + tropas + tiers*tierW. Mutável: diais. */
export const SCORE = { baseW: 100, tierW: 50 };

/**
 * UPGRADE (F2.5): evoluir agora é uma OBRA, não um clique instantâneo.
 * Duração = timePerTier × (tier+1) segundos (T1→T2: 1×, T2→T3: 2×). Durante a obra:
 * produção PARA, canhão não atira e o dano recebido é multiplicado por vulnMul
 * (escudo perde a proteção — a base está "aberta"). Captura durante a obra CANCELA
 * o investimento. timePerTier 0 ⇒ upgrade instantâneo (regra antiga). Mutável: diais.
 */
export const UPGRADE = { timePerTier: 6, vulnMul: 1.3 };

/**
 * AI_TUNING (F2.5): diais da IA fora do contrato DIFFICULTY.
 * buildTargetW = bônus de score p/ atacar base em obra (punir greed é jogar bem).
 * defendThresh/helperDrain = regra de defesa (antes hardcoded 0.9/0.6 no aiThink).
 * cannonAvoidW = peso do custo estimado de cruzar alcance de canhão hostil na escolha de alvo.
 */
export const AI_TUNING = {
  buildTargetW: 30,
  // 0.82 (era 0.9): self-play mostrou defesa reagindo tarde demais (partidas de
  // 45s decididas por rush cego); 0.78 travava partidas IA×IA em dreno defensivo
  // perpétuo — 0.82 é o meio-termo medido (balance-report 2026-07-06).
  defendThresh: 0.82,
  helperDrain: 0.6,
  cannonAvoidW: 1.0,
  coreW: 45,
  supplyAvoidW: 0.08,
};

/**
 * CORE (F2.5): vitória por DOMÍNIO — segurar a fortaleza central por holdSeconds
 * contínuos vence a partida (força conflito no meio do mapa e mata a varredura
 * final tediosa). 0 ⇒ desligado (vitória só por eliminação).
 */
// 35 (era 45): no self-play o domínio NUNCA decidia (0% em 160 partidas) — o
// anel era mais longo que a própria partida (balance-report 2026-07-06).
export const CORE = { holdSeconds: 35 };

/**
 * NEUTRAL (F2.5): bases neutras crescem devagar até min(cap, growthCap) —
 * esperar p/ expandir passa a CUSTAR (pressão de tempo na abertura).
 * growthRate 0 ⇒ neutras estáticas (regra antiga).
 */
export const NEUTRAL = { growthRate: 0.12, growthCap: 40 };

/**
 * SUPPLY (F2.5): atrito de suprimento — frota a mais de `range` de QUALQUER base
 * do próprio dono perde attritionPerSec (fração/s) e morre abaixo de 1 tropa.
 * Pune o deathball transcontinental; expandir por saltos vira logística.
 * attritionPerSec 0 ⇒ desligado.
 */
// range 720 (era 430): escala do mundo 4× (F5-lite) — a REGRA continua a mesma.
export const SUPPLY = { range: 720, attritionPerSec: 0.02 };

/**
 * ROUTE (F4-lite): rotas de suprimento — botão DIREITO arrastado liga base→base
 * aliada; a cada `interval` s a origem envia `ratio` do excedente acima de `keep`.
 * O jogo vira desenhar uma REDE (que o inimigo corta com interceptação).
 * interval 0 ⇒ desligado. Rota pausa durante obra e morre se o destino cair.
 */
export const ROUTE = { interval: 3.5, ratio: 0.35, keep: 12 };

/**
 * DOCTRINES (F4-lite): poder ativo por partida (Q). O jogador escolhe no menu;
 * a IA usa a da persona (agressiva=blitz, defensiva=muralha, econômica=mobilização,
 * equilibrada=sorteio). Mesmas regras p/ os dois lados.
 */
export const DOCTRINES: Readonly<Record<DoctrineId, DoctrineConfig>> = {
  blitz: {
    label: 'Blitz',
    // 1.6 (era 1.45): a mais fraca na matriz doutrina×doutrina do self-play
    // (38–47%) — buff leve (probe 2026-07-06).
    hint: 'frotas +60% de velocidade por 8s',
    duration: 8,
    cooldown: 45,
    fleetSpeedMul: 1.6,
    dmgTakenMul: 1,
    prodMul: 1,
  },
  bulwark: {
    label: 'Muralha',
    hint: 'bases recebem −45% de dano por 6s',
    duration: 6,
    cooldown: 45,
    fleetSpeedMul: 1,
    dmgTakenMul: 0.55,
    prodMul: 1,
  },
  surge: {
    label: 'Mobilização',
    // 1.5/55 (eram 1.9/50): dominava o meta no self-play (76% de winrate média;
    // economia composta com uptime alto) — nerf medido (probe 2026-07-06).
    hint: 'produção +50% por 8s',
    duration: 8,
    cooldown: 55,
    fleetSpeedMul: 1,
    dmgTakenMul: 1,
    prodMul: 1.5,
  },
};

/** Ordem canônica p/ ciclar/selecionar doutrina. */
export const DOCTRINE_ORDER: readonly DoctrineId[] = ['blitz', 'bulwark', 'surge'];

/**
 * MAPGEN (F4/F5-lite): densidade e variedade do mapa. Mais nós = mais frentes =
 * mais decisões por minuto; o LAYOUT (sorteado por seed) muda a geometria:
 * classic (espalhado) · lanes (corredor central) · flanks (alas norte/sul).
 * 1v1 usa PARES espelhados (neutralPairs); FFA distribui neutralsPerRival por
 * lado sem espelho (a posição é parte do jogo num FFA).
 */
export const MAPGEN = { neutralPairs: 14, neutralsPerRival: 11, minDist: 120 };

/**
 * PERSONAS (F2.5): estilos de jogo da IA, sorteados por seed (easy é sempre
 * 'balanced'). Modulam DIFFICULTY por multiplicadores — a MESMA dificuldade
 * joga diferente de partida em partida, e o jogador precisa ler qual veio.
 */
export const PERSONAS: Readonly<Record<AIPersona, PersonaConfig>> = {
  balanced: {
    label: 'Equilibrada',
    aiTickMul: 1,
    expandThreshMul: 1,
    expandForceMul: 1,
    antiPlayerWMul: 1,
    upgradeChanceMul: 1,
    defendThreshMul: 1,
    coordinated: false,
  },
  rusher: {
    label: 'Agressiva',
    aiTickMul: 0.85,
    expandThreshMul: 0.75,
    // 1.05/1.8 (eram 1.1/2.2): rush dominava o meta no self-play (63% e
    // subindo a cada buff de defesa) — balance-report 2026-07-06.
    expandForceMul: 1.05,
    antiPlayerWMul: 1.8,
    upgradeChanceMul: 0.5,
    defendThreshMul: 1.15,
    coordinated: true,
  },
  boomer: {
    label: 'Econômica',
    aiTickMul: 1,
    // 1.05/1.6 (eram 1.15/2.0): upar demais = muitas janelas de obra e pouca
    // pressão (34% no self-play) — balance-report 2026-07-06.
    expandThreshMul: 1.05,
    expandForceMul: 0.95,
    antiPlayerWMul: 0.45,
    upgradeChanceMul: 1.6,
    defendThreshMul: 1,
    coordinated: false,
  },
  turtle: {
    label: 'Defensiva',
    aiTickMul: 1.1,
    // 1.15/1.25 (eram 1.35/1.15): com 1.35 a turtle nunca expandia e terminava
    // com 29% de winrate no self-play — agora expande um pouco mais cedo e o
    // contra-ataque vai mais pesado (balance-report 2026-07-06).
    expandThreshMul: 1.15,
    expandForceMul: 1.25,
    antiPlayerWMul: 0.8,
    upgradeChanceMul: 1.2,
    defendThreshMul: 0.6,
    coordinated: true,
  },
};

/** Ordem canônica p/ o sorteio determinístico de persona. */
export const PERSONA_ORDER: readonly AIPersona[] = ['balanced', 'rusher', 'boomer', 'turtle'];

/**
 * ENGAGE (F2.5): interceptação de frotas em trânsito. Frotas de donos diferentes
 * a até `radius` uma da outra brigam no ar: a menor morre, a maior segue com a
 * diferença (mesma aritmética da chegada). radius 0 ⇒ sem interceptação (regra antiga).
 */
export const ENGAGE = { radius: 16 };

/** Custo de upgrade de uma base no tier atual: 20*(tier+1). T1->20, T2->40. */
export function upgradeCost(tier: number): number {
  return Math.round(20 * (tier + 1));
}
