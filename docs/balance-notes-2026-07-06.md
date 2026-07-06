# Notas de calibração por self-play — 2026-07-06

`pnpm balance` (torneio IA×IA, 160 partidas de personas hard×hard + sanity de dificuldades, ~1s)
gera `docs/balance-report.md` (SOBRESCRITO a cada run). Este arquivo guarda a **história e as
decisões** das rodadas de calibração — o que o report não guarda.

## Baseline (diais originais da F2.5)

Spread de personas 29–61% (Defensiva 29% = morta) · hard×easy **50%** (dificuldade irrelevante) ·
mediana **0:45** (sem arco) · domínio do centro decidiu **0%** de 160 · 3 stalls.
Diagnóstico: **rush cego dominava o meta** — defesa reagia tarde (0.9), guarnição inicial 22 caía
no 1º all-in coordenado, e a partida acabava antes de qualquer mecânica tardia importar.

## Rodadas

| Rodada | Mudanças | Efeito medido |
|---|---|---|
| 1 | `defendThresh` 0.9→0.78 · guarnição inicial 22→**26** · turtle expande antes (1.35→1.15) e contra-ataca mais (1.15→1.25) · `CORE.holdSeconds` 45→**35** | turtle 29→45% ✓ · hard×easy 50→63% ✓ · rush ainda rei (rusher 63%), boomer despencou p/ 34% (upar = janela de obra + zero pressão) · stalls 3→7 |
| 2 | easy pensa mais devagar (`aiTick` 1.1→**1.4**, upgrade 0.2→0.15) · rusher nerf (força 1.1→1.05, antiPlayer 2.2→**1.8**) · boomer buff (thresh 1.15→1.05, upgrade 2.0→**1.6**) | hard×easy 63→**71%** ✓ · spread apertou · stalls 7→13 ⚠️ (defesa 0.78 responsiva demais → dreno perpétuo, ninguém fecha) |
| 3 (final) | `defendThresh` 0.78→**0.82** (meio-termo) | stalls 13→10 · spread final **36–58%** · mediana 0:48 |

## Estado final e leitura honesta

- **Personas niveladas o suficiente** p/ playtest (36–58%; nenhuma morta, nenhuma auto-win).
- **Dificuldade tem contraste real** (hard×easy 71% em IA espelhada; contra humano novato o gap
  será maior — easy pensa a 1.4s).
- **Duração IA×IA continua curta (~0:48 mediana)** — humanos defendem/fintam melhor que a
  heurística, então a partida real deve alongar. NÃO calibrar mais por IA×IA: risco de overfit.
- **Domínio do centro nunca decidiu em IA×IA**: a IA prioriza eliminação e as partidas acabam
  antes dos 35s de anel. A mecânica existe para punir entrincheiramento (humano turtle) — validar
  em playtest humano antes de mexer de novo.
- **10/160 stalls** são espelhos defensivos IA×IA (turtle/boomer dos dois lados); vs jogador
  passivo a IA SEMPRE fecha (garantido por `match.test.ts`). Aceitável.

## Processo p/ a próxima calibração

1. Jogar de verdade (isso aqui não substitui playtest).
2. Mexer nos diais em `packages/shared/src/config.ts` (ou ao vivo no overlay `O`).
3. `pnpm balance` → conferir que nenhuma persona morreu (<35%) nem virou auto-win (>65%).
4. `pnpm goldens:update` (mudar dial muda os hashes congelados — é esperado) e comitar o diff.
