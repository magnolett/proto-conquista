import type {
  Config,
  TierConfig,
  Difficulty,
  DifficultyConfig,
  BaseKind,
  BaseKindConfig,
} from './types.js';

/**
 * CFG base — "diais" de balanceamento.
 * worldW/worldH definem o mundo LÓGICO da sim (a render escala p/ a tela).
 * O protótipo single-file usava innerWidth/innerHeight; fixamos aqui p/ determinismo.
 */
export const CFG: Config = {
  fleetSpeed: 135,
  sendDefault: 0.5,
  worldW: 1280,
  worldH: 720,
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
 * DIFFICULTY — valores EXATOS do contrato de costuras compartilhado.
 * Não alterar sem alinhar com as outras frentes.
 */
export const DIFFICULTY: Readonly<Record<Difficulty, DifficultyConfig>> = {
  easy: {
    label: 'Fácil',
    aiTick: 1.1,
    expandThresh: 0.75,
    expandForce: 0.55,
    tierW: 35,
    distW: 0.2,
    antiPlayerW: 10,
    upgradeChance: 0.2,
  },
  normal: {
    label: 'Normal',
    aiTick: 0.7,
    expandThresh: 0.6,
    expandForce: 0.6,
    tierW: 45,
    distW: 0.15,
    antiPlayerW: 25,
    upgradeChance: 0.35,
  },
  hard: {
    label: 'Difícil',
    aiTick: 0.45,
    expandThresh: 0.55,
    expandForce: 0.65,
    tierW: 55,
    distW: 0.12,
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
  roadRadius: 100,
  mudRadius: 90,
};

/** Névoa de guerra (F2): raio de visão ao redor de cada base/frota sua. Mutável: dial. */
export const FOG = { sightRadius: 230 };

/** Pesos do placar (F2): pontuação = bases*baseW + tropas + tiers*tierW. Mutável: diais. */
export const SCORE = { baseW: 100, tierW: 50 };

/** Custo de upgrade de uma base no tier atual: 20*(tier+1). T1->20, T2->40. */
export function upgradeCost(tier: number): number {
  return Math.round(20 * (tier + 1));
}
