# 05 — Roadmap

Entrega por fases; cada fase é jogável e fecha um risco. Ordem pensada pra **provar diversão antes de investir em infra**.

---

## F0 — Protótipo (provar a jogabilidade) ✅ *jogável e divertido (playtest humano OK)*

**Escopo:** single-file (Canvas+JS), bases/tiers/frotas/combate/captura, IA honesta (defende/expande/evolui), multi-seleção, mapa espelhado, vitória/derrota/restart.
**Critério de saída:** o dono joga e **se diverte**; a partida tem arco (abrir → meio → fim) e a IA é um oponente real.
**Pendência:** balanceamento por playtest — agora via diais em runtime no overlay (`O` + `Tab`/`-`/`=`).

## F1 — Graduação técnica (sustentar o crescimento) ✅ *completo (CI verde + deploy)*

**Escopo:** migrar pra **TypeScript + Vite**; extrair **`packages/sim` determinística pura** (PRNG mulberry32 seedado no state, sem `Math.random`/`Date.now`) separada da render; `packages/shared` com os diais tipados; **testes** (Vitest + fast-check: conservação, captura; + golden replays por seed); git.
**Entregue (2026-06-24):** monorepo pnpm; `pnpm typecheck` 0 erros e **22 testes** verdes; sim isolável e replayável; render só desenha; `game.js` aposentado.
**Entregue:** CI (`pnpm typecheck`/`test`/`build` no push) + deploy automático no GitHub Pages.

## F2 — Profundidade (sem arte nova) ✅ *implementado (falta calibração humana)*

**Escopo (ver [04-game-design](04-game-design.md)):** dificuldades de IA, névoa de guerra, tipos de base (canhão/escudo/veloz por cor+forma), cronômetro+pontuação, modificadores de mapa.
**Critério de saída:** ≥3 estilos de partida sentidos como distintos; IA fácil/médio/difícil bem separadas.
**Entregue (2026-06-24):** tipos de base (escudo/veloz/canhão), modificadores de mapa (estrada/lamaçal), névoa de guerra (tecla `F`) e cronômetro+placar — determinísticos por seed, com +19 testes (41 no total). Pendente: calibração humana dos diais; IA desviar do alcance de canhões.

## F3 — Apresentação e entrega — *deploy estático já no ar (adiantado)*

**Escopo:** build de produção ✅, deploy web estático ✅ ([magnolett.github.io/proto-conquista](https://magnolett.github.io/proto-conquista/), automático no push), polimento de feedback (sons sintetizados via Web Audio / shader, **sem assets**), menu/opções.
**Critério de saída:** link jogável público; 60 FPS em hardware modesto.

## F4+ — Multiplayer e modos (se a diversão sustentar)

**Escopo:** PvP com **servidor autoritativo** (a sim pura da F1 vira a verdade do servidor), escaramuças/campanha, wrapper desktop (Tauri).
**Fora até aqui:** rede, mobile, monetização.

---

## Princípios de sequência

1. **Diversão antes de infra** — não graduar/deployar antes da F0 divertir.
2. **Sim pura antes de multiplayer** — F1 (determinismo + testes) é pré-requisito do PvP autoritativo.
3. **Zero asset de arte em todas as fases** — profundidade e feedback vêm de sistema, forma, luz e som sintetizado.
4. **Todo dial em config**, testável por seed.
