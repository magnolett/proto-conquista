# Balance report — self-play (gerado por `pnpm balance`)

Partidas simuladas a 60 Hz · teto 12 min · 10 seeds por matchup.

## Torneio de personas (hard × hard)

Winrate do lado LINHA contra o lado COLUNA (10 seeds):

| você \ IA | Equilibrada | Agressiva | Econômica | Defensiva |
|---|---|---|---|---|
| **Equilibrada** | 30% | 50% | 40% | 10% |
| **Agressiva** | 0% | 10% | 20% | 20% |
| **Econômica** | 20% | 80% | 80% | 30% |
| **Defensiva** | 60% | 80% | 70% | 40% |

Agregado por persona (soma dos dois lados):

| Persona | Jogos | Winrate | vit. por domínio | vit. por eliminação | duração média das vitórias |
|---|---|---|---|---|---|
| Equilibrada | 80 | 48% | 0% | 100% | 3:06 |
| Agressiva | 80 | 20% | 0% | 100% | 2:28 |
| Econômica | 80 | 45% | 0% | 100% | 3:29 |
| Defensiva | 80 | 66% | 2% | 98% | 3:03 |

**Globais:** 160 partidas · stalls (bateram 12 min): 17 · vitórias por DOMÍNIO do centro: 1% · duração mediana: 2:16 · p90: 6:17.

## Sanity de dificuldades (equilibrada × equilibrada, 8 seeds)

| Matchup (você × IA) | winrate do lado mais difícil |
|---|---|
| hard × easy | 25% |
| hard × normal | 33% |
| normal × easy | 25% |

## Observações automáticas

- ⚠️ **17 stall(s)**: partidas que bateram o teto de 12 min — investigar (IA sem fôlego p/ fechar? domínio desligado?).
- ⚠️ **Agressiva** fraca demais (20%): considerar reforçar.
- ⚠️ **Defensiva** forte demais (66%): considerar suavizar os multiplicadores.
- ⚠️ Domínio do centro quase nunca decide (<5%): o anel pode estar longo demais (CORE.holdSeconds).

> IA × IA aproxima, não substitui, playtest humano: personas jogam "honesto" e não fintam como gente.
