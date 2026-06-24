import type { Config, TierConfig, Difficulty, DifficultyConfig } from './types.js';

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

/** Custo de upgrade de uma base no tier atual: 20*(tier+1). T1->20, T2->40. */
export function upgradeCost(tier: number): number {
  return Math.round(20 * (tier + 1));
}
