/**
 * PRNG determinístico mulberry32.
 *
 * O contrato de costuras compartilhado fixa ESTA implementação. Para que o
 * `step` seja 100% reproduzível e snapshotável (golden replay), guardamos o
 * inteiro de estado `a` DENTRO do GameState e o avançamos de forma PURA, em vez
 * de fechar sobre uma closure mutável.
 *
 * `mulberry32` abaixo é a forma de referência (closure) — mantida idêntica ao
 * contrato p/ auditoria. A sim usa `nextRng` (versão pura) que produz a MESMA
 * sequência: dado o estado `a`, devolve o próximo `value` em [0,1) e o próximo
 * estado.
 */

/** Forma de referência do contrato (closure mutável). NÃO usada pela sim. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function (): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Resultado de um avanço puro do PRNG. */
export interface RngStep {
  /** Próximo valor pseudoaleatório em [0, 1). */
  readonly value: number;
  /** Próximo estado inteiro (uint32) a guardar no GameState. */
  readonly state: number;
}

/**
 * Avanço PURO do mulberry32: equivalente bit-a-bit a uma chamada da closure.
 * `a` é o estado guardado no GameState. Retorna o valor e o novo estado.
 */
export function nextRng(a: number): RngStep {
  let s = a | 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  // O estado persistido é exatamente o `a |= 0; a = (a + 0x6d2b79f5)|0` da closure,
  // i.e. o `s` já incrementado — assim a PRÓXIMA chamada continua a sequência.
  return { value, state: s >>> 0 };
}

/** Normaliza uma seed arbitrária p/ o estado inicial do PRNG (uint32). */
export function seedToState(seed: number): number {
  return seed >>> 0;
}
