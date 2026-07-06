# Balance report — self-play (gerado por `pnpm balance`)

Partidas simuladas a 60 Hz · teto 12 min · 10 seeds por matchup.

## Torneio de personas (hard × hard)

Winrate do lado LINHA contra o lado COLUNA (10 seeds):

| você \ IA | Equilibrada | Agressiva | Econômica | Defensiva |
|---|---|---|---|---|
| **Equilibrada** | 30% | 40% | 50% | 20% |
| **Agressiva** | 0% | 50% | 30% | 30% |
| **Econômica** | 40% | 30% | 50% | 30% |
| **Defensiva** | 80% | 70% | 60% | 60% |

Agregado por persona (soma dos dois lados):

| Persona | Jogos | Winrate | vit. por domínio | vit. por eliminação | duração média das vitórias |
|---|---|---|---|---|---|
| Equilibrada | 80 | 44% | 0% | 100% | 1:56 |
| Agressiva | 80 | 30% | 0% | 100% | 1:12 |
| Econômica | 80 | 40% | 0% | 100% | 2:03 |
| Defensiva | 80 | 66% | 0% | 100% | 1:52 |

**Globais:** 160 partidas · stalls (bateram 12 min): 16 · vitórias por DOMÍNIO do centro: 0% · duração mediana: 1:24 · p90: 3:39.

## Sanity de dificuldades (equilibrada × equilibrada, 8 seeds)

| Matchup (você × IA) | winrate do lado mais difícil |
|---|---|
| hard × easy | 50% |
| hard × normal | 38% |
| normal × easy | 25% |

## Observações automáticas

- ⚠️ **16 stall(s)**: partidas que bateram o teto de 12 min — investigar (IA sem fôlego p/ fechar? domínio desligado?).
- ⚠️ **Agressiva** fraca demais (30%): considerar reforçar.
- ⚠️ **Defensiva** forte demais (66%): considerar suavizar os multiplicadores.
- ⚠️ Domínio do centro quase nunca decide (<5%): o anel pode estar longo demais (CORE.holdSeconds).
- ⚠️ Mediana abaixo de 1:30: partidas curtas demais p/ ter arco.

> IA × IA aproxima, não substitui, playtest humano: personas jogam "honesto" e não fintam como gente.
