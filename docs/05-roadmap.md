# 05 — Roadmap

Entrega por fases; cada fase é jogável e fecha um risco. Ordem pensada pra **provar diversão antes de investir em infra**.

---

## F0 — Protótipo (provar a jogabilidade) ✅ *em playtest*

**Escopo:** single-file (Canvas+JS), bases/tiers/frotas/combate/captura, IA honesta (defende/expande/evolui), multi-seleção, mapa espelhado, vitória/derrota/restart.
**Critério de saída:** o dono joga e **se diverte**; a partida tem arco (abrir → meio → fim) e a IA é um oponente real.
**Pendência:** balanceamento (`CFG`/`TIERS`) por playtest.

## F1 — Graduação técnica (sustentar o crescimento)

**Escopo:** migrar pra **TypeScript + Vite**; extrair **`packages/sim` determinística pura** (PRNG seedado, sem `Math.random`/`Date.now`) separada da render; `packages/shared` com os diais tipados; **testes** (Vitest + fast-check: conservação de tropas, captura; + golden replays por seed); git + CI.
**Critério de saída:** `pnpm test`/`typecheck` verdes; sim isolável e replayável; render só desenha.

## F2 — Profundidade (sem arte nova)

**Escopo (ver [04-game-design](04-game-design.md)):** dificuldades de IA, névoa de guerra, tipos de base (canhão/escudo/veloz por cor+forma), cronômetro+pontuação, modificadores de mapa.
**Critério de saída:** ≥3 estilos de partida sentidos como distintos; IA fácil/médio/difícil bem separadas.

## F3 — Apresentação e entrega

**Escopo:** build de produção, deploy web estático, polimento de feedback (sons sintetizados via Web Audio / shader, **sem assets**), menu/opções.
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
