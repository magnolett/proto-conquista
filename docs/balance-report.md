# Balance report — self-play (gerado por `pnpm balance`)

Partidas simuladas a 60 Hz · teto 12 min · 10 seeds por matchup.

## Torneio de personas (hard × hard)

Winrate do lado LINHA contra o lado COLUNA (10 seeds):

| você \ IA | Equilibrada | Agressiva | Econômica | Defensiva |
|---|---|---|---|---|
| **Equilibrada** | 50% | 30% | 90% | 60% |
| **Agressiva** | 50% | 10% | 70% | 50% |
| **Econômica** | 50% | 10% | 80% | 50% |
| **Defensiva** | 30% | 20% | 50% | 60% |

Agregado por persona (soma dos dois lados):

| Persona | Jogos | Winrate | vit. por domínio | vit. por eliminação | duração média das vitórias |
|---|---|---|---|---|---|
| Equilibrada | 80 | 53% | 0% | 100% | 1:32 |
| Agressiva | 80 | 58% | 0% | 100% | 1:37 |
| Econômica | 80 | 36% | 0% | 100% | 0:47 |
| Defensiva | 80 | 41% | 0% | 100% | 1:05 |

**Globais:** 160 partidas · stalls (bateram 12 min): 10 · vitórias por DOMÍNIO do centro: 0% · duração mediana: 0:48 · p90: 3:11.

## Sanity de dificuldades (equilibrada × equilibrada, 8 seeds)

| Matchup (você × IA) | winrate do lado mais difícil |
|---|---|
| hard × easy | 71% |
| hard × normal | 63% |
| normal × easy | 50% |

## Observações automáticas

- ⚠️ **10 stall(s)**: partidas que bateram o teto de 12 min — investigar (IA sem fôlego p/ fechar? domínio desligado?).
- ⚠️ **Econômica** fraca demais (36%): considerar reforçar.
- ⚠️ Domínio do centro quase nunca decide (<5%): o anel pode estar longo demais (CORE.holdSeconds).
- ⚠️ Mediana abaixo de 1:30: partidas curtas demais p/ ter arco.

> IA × IA aproxima, não substitui, playtest humano: personas jogam "honesto" e não fintam como gente.
