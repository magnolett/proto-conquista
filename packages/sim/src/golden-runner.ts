import type { Difficulty } from '@conquista/shared';
import { createInitialState, step, cloneState } from './index.js';
import type { Inputs } from './index.js';

/**
 * Golden replays CONGELADOS — infraestrutura.
 *
 * O golden-replay.test.ts garante estabilidade RUN-VS-RUN (duas execuções no
 * mesmo processo batem). Ele NÃO pega regressão de comportamento entre versões
 * do código nem divergência entre máquinas/engines. Estes cenários canônicos
 * geram um HASH do estado final que fica comitado como snapshot: divergiu, ou a
 * regra mudou de propósito (rode `pnpm goldens:update` e comite o snapshot) ou
 * é REGRESSÃO. Rodando o mesmo teste no CI (Linux) e localmente (Windows),
 * qualquer não-determinismo cross-platform dispara o alarme cedo — pré-PvP.
 */
export interface GoldenScenario {
  readonly name: string;
  readonly seed: number;
  readonly difficulty: Difficulty;
  readonly steps: number;
}

export const GOLDEN_SCENARIOS: readonly GoldenScenario[] = [
  // curto: abertura + envios scriptados
  { name: 'normal-c0ffee-400', seed: 0xc0ffee, difficulty: 'normal', steps: 400 },
  // médio: obra conclui, interceptações e persona agindo
  { name: 'hard-42-1200', seed: 42, difficulty: 'hard', steps: 1200 },
  // longo: fases tardias (domínio/atrito/crescimento de neutras)
  { name: 'normal-bada55-3000', seed: 0xbada55, difficulty: 'normal', steps: 3000 },
];

/** Roteiro FIXO de inputs do jogador — exercita envio, obra c/ spec e waypoint. */
function scriptedInputs(i: number): Inputs {
  if (i === 20) return { sends: [{ sourceIds: [0, 1, 3], targetId: 2, ratio: 0.5 }] };
  if (i === 60) return { upgrades: [{ nodeId: 0, kind: 'shield' }] };
  if (i === 90) {
    return {
      sends: [{ sourceIds: [0], targetId: 5, ratio: 0.75, waypoint: { x: 400, y: 200 } }],
    };
  }
  if (i === 800) return { sends: [{ sourceIds: [0], targetId: 2, ratio: 0.25 }] };
  return {};
}

/** FNV-1a 32-bit (hex) — detector de mudança leve, sem dependência de crypto. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Resultado de um cenário: hash do estado COMPLETO + resumo legível p/ diff. */
export interface GoldenResult {
  readonly hash: string;
  readonly summary: {
    readonly time: string;
    readonly persona: string;
    readonly winner: string | null;
    readonly winReason: string | null;
    readonly rng: number;
    readonly fleets: number;
    readonly owners: Record<string, number>;
  };
}

/** Roda um cenário canônico até o limite de steps (ou fim de jogo). */
export function runGolden(sc: GoldenScenario): GoldenResult {
  const s = createInitialState(sc.seed, { difficulty: sc.difficulty });
  for (let i = 0; i < sc.steps && !s.gameOver; i++) {
    step(s, scriptedInputs(i), 1 / 60);
  }
  const final = cloneState(s);
  const owners: Record<string, number> = { you: 0, enemy: 0, neutral: 0 };
  for (const n of final.nodes) owners[n.owner] = (owners[n.owner] ?? 0) + 1;
  return {
    hash: fnv1a(JSON.stringify(final)),
    summary: {
      time: final.time.toFixed(4),
      persona: final.persona,
      winner: final.winner,
      winReason: final.winReason,
      rng: final.rng,
      fleets: final.fleets.length,
      owners,
    },
  };
}
