import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createInitialState, step, aiThink, effectiveAI } from '@conquista/sim';
import { PERSONA_ORDER, PERSONAS } from '@conquista/shared';
import type { AIPersona, Difficulty, Owner } from '@conquista/shared';

/**
 * BALANCE HARNESS (self-play): a IA joga contra si mesma em todas as combinações
 * de persona (e um sanity de dificuldades) por várias seeds, e o resultado vira
 * `docs/balance-report.md`. Ferramenta de CALIBRAÇÃO — não é teste de correção.
 *
 * Assimetrias conhecidas (leves, niveladas pelo mapa espelhado):
 *  - o lado 'enemy' pensa DENTRO do step; o lado 'you' pensa logo após;
 *  - o lado 'you' é tickado por um timer do harness com o MESMO aiTick efetivo.
 */

interface MatchResult {
  readonly winner: Owner | null;
  readonly winReason: string | null;
  readonly time: number;
  readonly stalled: boolean;
}

const DT = 1 / 60;
const MAX_MINUTES = 12;

function selfPlay(
  seed: number,
  youDiff: Difficulty,
  youPersona: AIPersona,
  enemyDiff: Difficulty,
  enemyPersona: AIPersona,
): MatchResult {
  const s = createInitialState(seed, { difficulty: enemyDiff, persona: enemyPersona });
  let youTimer = 0;
  const maxSteps = Math.round((MAX_MINUTES * 60) / DT);
  for (let i = 0; i < maxSteps && !s.gameOver; i++) {
    step(s, undefined, DT); // IA 'enemy' nativa pensa dentro do step
    if (s.gameOver) break;
    youTimer -= DT;
    if (youTimer <= 0) {
      // o lado espelhado usa a própria dificuldade/persona (troca-e-restaura)
      s.difficulty = youDiff;
      aiThink(s, 'you', youPersona);
      s.difficulty = enemyDiff;
      youTimer = effectiveAI(youDiff, youPersona).aiTick;
    }
  }
  return {
    winner: s.winner,
    winReason: s.winReason,
    time: s.time,
    stalled: !s.gameOver,
  };
}

const fmt = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};
const pct = (x: number, n: number): string => (n === 0 ? '—' : `${Math.round((100 * x) / n)}%`);

describe('Balance por self-play (gera docs/balance-report.md)', () => {
  it('torneio de personas + sanity de dificuldades', () => {
    const seeds = Array.from({ length: 10 }, (_, i) => 1000 + i * 7919);
    const lines: string[] = [];
    lines.push('# Balance report — self-play (gerado por `pnpm balance`)');
    lines.push('');
    lines.push(`Partidas simuladas a ${Math.round(1 / DT)} Hz · teto ${MAX_MINUTES} min · ${seeds.length} seeds por matchup.`);
    lines.push('');

    // ===== Torneio A: personas (hard × hard) =====
    interface Agg {
      games: number;
      wins: number;
      core: number;
      elim: number;
      timeSum: number;
      stalls: number;
    }
    const agg = new Map<AIPersona, Agg>();
    for (const p of PERSONA_ORDER) agg.set(p, { games: 0, wins: 0, core: 0, elim: 0, timeSum: 0, stalls: 0 });

    const matrix: string[][] = [];
    let totalStalls = 0;
    let totalGames = 0;
    let coreWins = 0;
    let durations: number[] = [];

    for (const pYou of PERSONA_ORDER) {
      const row: string[] = [];
      for (const pEnemy of PERSONA_ORDER) {
        let youWins = 0;
        for (const seed of seeds) {
          const r = selfPlay(seed, 'hard', pYou, 'hard', pEnemy);
          totalGames++;
          const aYou = agg.get(pYou)!;
          const aEnemy = agg.get(pEnemy)!;
          aYou.games++;
          aEnemy.games++;
          if (r.stalled) {
            totalStalls++;
            aYou.stalls++;
            aEnemy.stalls++;
            continue;
          }
          durations.push(r.time);
          if (r.winReason === 'core') coreWins++;
          const winPersona = r.winner === 'you' ? aYou : aEnemy;
          winPersona.wins++;
          if (r.winReason === 'core') winPersona.core++;
          else winPersona.elim++;
          winPersona.timeSum += r.time;
          if (r.winner === 'you') youWins++;
        }
        row.push(pct(youWins, seeds.length));
      }
      matrix.push(row);
    }

    lines.push('## Torneio de personas (hard × hard)');
    lines.push('');
    lines.push('Winrate do lado LINHA contra o lado COLUNA (10 seeds):');
    lines.push('');
    lines.push('| você \\ IA | ' + PERSONA_ORDER.map((p) => PERSONAS[p].label).join(' | ') + ' |');
    lines.push('|---|' + PERSONA_ORDER.map(() => '---').join('|') + '|');
    PERSONA_ORDER.forEach((p, i) => {
      lines.push(`| **${PERSONAS[p].label}** | ` + matrix[i]!.join(' | ') + ' |');
    });
    lines.push('');
    lines.push('Agregado por persona (soma dos dois lados):');
    lines.push('');
    lines.push('| Persona | Jogos | Winrate | vit. por domínio | vit. por eliminação | duração média das vitórias |');
    lines.push('|---|---|---|---|---|---|');
    for (const p of PERSONA_ORDER) {
      const a = agg.get(p)!;
      lines.push(
        `| ${PERSONAS[p].label} | ${a.games} | ${pct(a.wins, a.games)} | ${pct(a.core, a.wins)} | ${pct(a.elim, a.wins)} | ${a.wins ? fmt(a.timeSum / a.wins) : '—'} |`,
      );
    }
    lines.push('');
    durations.sort((a, b) => a - b);
    const median = durations.length ? durations[Math.floor(durations.length / 2)]! : 0;
    lines.push(
      `**Globais:** ${totalGames} partidas · stalls (bateram ${MAX_MINUTES} min): ${totalStalls} · ` +
        `vitórias por DOMÍNIO do centro: ${pct(coreWins, totalGames - totalStalls)} · ` +
        `duração mediana: ${fmt(median)} · p90: ${durations.length ? fmt(durations[Math.floor(durations.length * 0.9)]!) : '—'}.`,
    );
    lines.push('');

    // ===== Torneio B: sanity de dificuldades (balanced × balanced) =====
    lines.push('## Sanity de dificuldades (equilibrada × equilibrada, 8 seeds)');
    lines.push('');
    lines.push('| Matchup (você × IA) | winrate do lado mais difícil |');
    lines.push('|---|---|');
    const sanity: Array<[Difficulty, Difficulty]> = [
      ['hard', 'easy'],
      ['hard', 'normal'],
      ['normal', 'easy'],
    ];
    const sanitySeeds = seeds.slice(0, 8);
    for (const [dYou, dEnemy] of sanity) {
      let wins = 0;
      let games = 0;
      for (const seed of sanitySeeds) {
        const r = selfPlay(seed, dYou, 'balanced', dEnemy, 'balanced');
        if (r.stalled) continue;
        games++;
        if (r.winner === 'you') wins++;
      }
      lines.push(`| ${dYou} × ${dEnemy} | ${pct(wins, games)} |`);
    }
    lines.push('');

    // ===== Observações automáticas =====
    lines.push('## Observações automáticas');
    lines.push('');
    const notes: string[] = [];
    if (totalStalls > 0) {
      notes.push(
        `- ⚠️ **${totalStalls} stall(s)**: partidas que bateram o teto de ${MAX_MINUTES} min — investigar (IA sem fôlego p/ fechar? domínio desligado?).`,
      );
    } else {
      notes.push('- ✅ Zero stalls: toda partida TERMINA (eliminação ou domínio).');
    }
    for (const p of PERSONA_ORDER) {
      const a = agg.get(p)!;
      const wr = a.games ? a.wins / a.games : 0;
      if (wr > 0.62) notes.push(`- ⚠️ **${PERSONAS[p].label}** forte demais (${Math.round(wr * 100)}%): considerar suavizar os multiplicadores.`);
      if (wr < 0.38) notes.push(`- ⚠️ **${PERSONAS[p].label}** fraca demais (${Math.round(wr * 100)}%): considerar reforçar.`);
    }
    const coreShare = (totalGames - totalStalls) ? coreWins / (totalGames - totalStalls) : 0;
    if (coreShare < 0.05) notes.push('- ⚠️ Domínio do centro quase nunca decide (<5%): o anel pode estar longo demais (CORE.holdSeconds).');
    if (coreShare > 0.7) notes.push('- ⚠️ Domínio decide demais (>70%): a eliminação virou detalhe — talvez alongar CORE.holdSeconds.');
    if (median > 6 * 60) notes.push('- ⚠️ Mediana acima de 6 min: partidas arrastadas p/ o alvo "poucos minutos".');
    if (median < 90) notes.push('- ⚠️ Mediana abaixo de 1:30: partidas curtas demais p/ ter arco.');
    lines.push(...notes);
    lines.push('');
    lines.push('> IA × IA aproxima, não substitui, playtest humano: personas jogam "honesto" e não fintam como gente.');
    lines.push('');

    writeFileSync('docs/balance-report.md', lines.join('\n'));
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));

    // Invariantes DURAS do harness (não de balance): todas as partidas rodaram.
    expect(totalGames).toBe(PERSONA_ORDER.length * PERSONA_ORDER.length * seeds.length);
  });
});
