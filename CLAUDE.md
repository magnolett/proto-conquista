# CLAUDE.md — Conquista *(título provisório)*

## Objetivo
RTS de **conquista de território em tempo real** no estilo Galcon/Auralux/Nexus Wars: bases produzem tropas, frotas viajam pelo mapa, captura por superioridade numérica, partidas curtas contra IA. **Tese central: a profundidade vem da SIMULAÇÃO (economia, timing, geometria, multi-frente), não dos gráficos.** Arte = formas + luz + código (**zero modelagem**), tudo **code-first** (sem editor visual). Pilares: time-to-fun < 30s, decisão > reflexo, oponente de IA que joga de verdade.

## Estado (real, não aspiracional)
**Monorepo TypeScript jogável — fonte única.** Graduado do protótipo single-file (F0→F1) para **pnpm + Vite + TS strict**: `packages/sim` (simulação determinística PURA, sem `Math.random`/`Date.now`, PRNG mulberry32 no state), `packages/shared` (diais tipados `CFG`/`TIERS`/`DIFFICULTY`), `apps/web` (Canvas 2D, só render+input). **Verificado:** `pnpm typecheck` 0 erros · **22 testes** (Vitest + fast-check: conservação, captura, golden replays, PRNG, IA) · `pnpm --filter web build` ok. IA com 3 dificuldades (`G`) + fix de superinvestida; overlay de debug + edição de diais em runtime (`O`/`Tab`/`-`/`=`); seed visível + `Shift+R`. O `game.js`/`index.html` single-file foram **aposentados** (preservados no histórico git). **Ainda NÃO há:** deploy, CI, playtest/balanceamento humano. Ver [docs/05](docs/05-roadmap.md).

## Stack
- **Atual:** **TypeScript strict + Vite**, monorepo pnpm — `packages/sim` (determinística pura, PRNG seedado no state), `packages/shared` (diais tipados), `apps/web` (Canvas 2D, render+input). Golden replays + testes por seed, como interregno/project-football ([ADR-0003](docs/decisions/ADR-0003-rts-tempo-real-autoritativo.md) + [docs/03](docs/03-arquitetura.md)).
- **Próximo:** profundidade (F2: névoa, tipos de base) + deploy estático (F3); PvP autoritativo (F4) reusa `packages/sim`.

## Arquitetura (monorepo)
- **`packages/sim`** (pura, sem DOM): `GameState` (`nodes[]`/`fleets[]`/`rng`/`difficulty`/…), `createInitialState(seed, opts)` + `step(state, inputs, dt)` (economia · frotas · combate · IA por tick · vitória). PRNG `mulberry32` com estado no `GameState` (avanço puro, `nextRng`). Inputs do jogador entram como **dado** (`Inputs { sends, upgrades }`), não event handler.
- **`packages/shared`:** `CFG`/`TIERS`/`DIFFICULTY` tipados (os diais) + tipos.
- **`apps/web`:** Canvas 2D — só render (bases com *glow*, frotas, guias, HUD, overlay de debug) + input (arraste, caixa, teclas). Mundo lógico fixo (`worldW×worldH`) com fit+letterbox; a render **nunca decide regra**. **Zero asset.**
- **IA (`aiThink`):** heurística determinística honesta (mesmas regras, só lê estado público), parametrizada por `DIFFICULTY[difficulty]`, com fix de superinvestida (`committed[]`).

## Regras invariantes (não violar)
- **A sim é a verdade; a render NUNCA decide regra.** Hoje é single-player local; ao graduar (F1), a sim pura é autoritativa. *Lição herdada do project-football: bug visual ≠ bug de sim.*
- **Zero modelagem / zero asset de arte.** Beleza vem de paleta coesa + luz + forma/shader. Se precisar de "objeto", kit CC0 (Kenney), **nunca modelar** ([ADR-0002](docs/decisions/ADR-0002-arte-procedural-sem-modelagem.md)).
- **Determinismo no alvo:** `packages/sim` sem float não-determinístico/`Math.random`/`Date.now`; PRNG injetado. Golden replay divergente = **alarme de regressão**.
- **Balanceamento em config**, nunca hardcoded esparramado — hoje em `CFG`/`TIERS` no topo de `game.js`; no alvo, um módulo de "diais".

## Rodar
`pnpm install` na raiz, depois `pnpm --filter web dev` (Vite em http://localhost:5173). Testes: `pnpm test`. Typecheck: `pnpm typecheck`. Controles no rodapé da tela e em [docs/04](docs/04-game-design.md).

## Critérios de qualidade
Sim pura/determinística (no alvo) · render não decide regra · IA joga pelas mesmas regras · **zero asset de arte** · balanceamento em config testável por seed.

## Instruções para agentes
- **Dono:** `realtime-game-netcode-engineer`. Graduação TS/build/deploy: `deploy-release-manager`.
- Leia [docs/02](docs/02-stack-tecnologica.md) (decisão de engine) e os ADRs antes de propor trocar de stack — a escolha **code-first / zero-modelagem** é deliberada.
- Não introduza dependência de editor visual nem pipeline de assets 3D; não mova regra autoritativa pra render.
