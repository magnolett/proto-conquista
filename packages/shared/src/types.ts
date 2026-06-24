/**
 * Tipos compartilhados entre a sim e a render.
 * NÃO contém lógica nem DOM — apenas formas de dados.
 */

/** Dono de uma base ou frota. */
export type Owner = 'you' | 'enemy' | 'neutral';

/** Nível de dificuldade da IA. */
export type Difficulty = 'easy' | 'normal' | 'hard';

/** Configuração de um tier de base (produção / teto / raio). */
export interface TierConfig {
  /** Tropas produzidas por segundo. Mutável: é um "dial" ajustável em runtime (playtest). */
  prod: number;
  /** Teto de tropas (produção só cresce abaixo dele). Mutável: dial de runtime. */
  cap: number;
  /** Raio visual/de colisão. */
  readonly r: number;
}

/** "Diais" de balanceamento global. */
export interface Config {
  /** Velocidade das frotas em px/s. Mutável: dial ajustável em runtime (playtest). */
  fleetSpeed: number;
  /** Fração padrão de envio (0..1). */
  readonly sendDefault: number;
  /** Largura do mundo lógico da sim (independe da tela). */
  readonly worldW: number;
  /** Altura do mundo lógico da sim. */
  readonly worldH: number;
}

/** Pesos e limiares da IA por dificuldade (valores do contrato de costuras). */
export interface DifficultyConfig {
  /** Rótulo legível (pt-br). */
  readonly label: string;
  /** Intervalo entre "pensamentos" da IA, em segundos. */
  readonly aiTick: number;
  /** Limiar de excedente p/ uma base atacar (fração do cap). */
  readonly expandThresh: number;
  /** Fração da guarnição usada num ataque. */
  readonly expandForce: number;
  /** Peso do tier do alvo no score. */
  readonly tierW: number;
  /** Peso (penalidade) da distância no score. */
  readonly distW: number;
  /** Bônus de score por mirar uma base do jogador. */
  readonly antiPlayerW: number;
  /** Probabilidade de fazer upgrade econômico num tick. */
  readonly upgradeChance: number;
}

/** Especialidade (tipo) de uma base. 'normal' = comportamento padrão. */
export type BaseKind = 'normal' | 'cannon' | 'shield' | 'fast';

/**
 * Parâmetros de cada tipo de base (os "diais" das especialidades).
 * Valores neutros (mul = 1, range = 0) ⇒ sem efeito — é exatamente o caso de 'normal',
 * o que mantém a regra atual intacta para bases comuns.
 */
export interface BaseKindConfig {
  /** Rótulo legível (pt-br). */
  readonly label: string;
  /** Multiplicador do dano recebido em ataque. <1 (escudo) = mais resistente. Mutável: dial. */
  dmgTakenMul: number;
  /** Multiplicador de velocidade das frotas que PARTEM desta base. >1 (veloz). Mutável: dial. */
  fleetSpeedMul: number;
  /** Alcance do canhão (0 = não é canhão); frotas de outro dono dentro dele tomam dano. Mutável. */
  cannonRange: number;
  /** Dano por segundo do canhão a frotas inimigas no alcance. Mutável: dial. */
  cannonDps: number;
}
