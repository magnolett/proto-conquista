# CLAUDE.md — Conquista *(título provisório)*

## Objetivo
RTS de **conquista de território em tempo real** no estilo Galcon/Auralux/Nexus Wars: bases produzem tropas, frotas viajam pelo mapa, captura por superioridade numérica, partidas curtas contra IA. **Tese central: a profundidade vem da SIMULAÇÃO (economia, timing, geometria, multi-frente), não dos gráficos.** Arte = formas + luz + código (**zero modelagem**), tudo **code-first** (sem editor visual). Pilares: time-to-fun < 30s, decisão > reflexo, oponente de IA que joga de verdade.

## Estado (real, não aspiracional)
**Protótipo single-file jogável.** `index.html` + `game.js` (Canvas 2D, **JS puro, sem build**) — abre por duplo-clique. Sim + render no mesmo arquivo (~310 linhas). Sintaxe validada (`node --check` OK) + lógica revisada. **Ainda NÃO há:** playtest/balanceamento, testes automatizados, TypeScript, monorepo, git, deploy. Tudo isso é alvo do roadmap ([docs/05](docs/05-roadmap.md)).

## Stack atual × alvo
- **Atual:** HTML + Canvas 2D + JavaScript ES2020, single-file, **zero dependência, zero build**.
- **Alvo** ([ADR-0003](docs/decisions/ADR-0003-rts-tempo-real-autoritativo.md) + [docs/03](docs/03-arquitetura.md)): **TypeScript strict + Vite**, monorepo com **`packages/sim` determinística pura** (sem `Math.random`/`Date.now`, PRNG seedado) separada da render — habilita golden replays e testes por seed, como interregno/project-football.

## Arquitetura (hoje, em `game.js`)
- **Estado:** `nodes[]` (bases: dono/tropas/tier/cap/prod) + `fleets[]` (frotas em trânsito).
- **Loop:** `requestAnimationFrame` → `update(dt)` (economia, movimento de frotas, combate na chegada, IA por timer, vitória) → `render()`.
- **IA (`aiThink`):** heurística determinística por ticks — defende base ameaçada, expande pro alvo mais barato/valioso, faz upgrade na retaguarda. **Não trapaceia** (mesmas regras do jogador).
- **Entrada:** arraste base→base (enviar), caixa de seleção + clique (multi-envio), teclas 1-4/U/R/Espaço.
- **Render:** círculos com *glow*, frotas como setas, guias até o mouse, HUD. **Zero asset.**

## Regras invariantes (não violar)
- **A sim é a verdade; a render NUNCA decide regra.** Hoje é single-player local; ao graduar (F1), a sim pura é autoritativa. *Lição herdada do project-football: bug visual ≠ bug de sim.*
- **Zero modelagem / zero asset de arte.** Beleza vem de paleta coesa + luz + forma/shader. Se precisar de "objeto", kit CC0 (Kenney), **nunca modelar** ([ADR-0002](docs/decisions/ADR-0002-arte-procedural-sem-modelagem.md)).
- **Determinismo no alvo:** `packages/sim` sem float não-determinístico/`Math.random`/`Date.now`; PRNG injetado. Golden replay divergente = **alarme de regressão**.
- **Balanceamento em config**, nunca hardcoded esparramado — hoje em `CFG`/`TIERS` no topo de `game.js`; no alvo, um módulo de "diais".

## Rodar
Duplo-clique em `index.html` (ou Live Server). Sem `npm`, sem build. Controles no rodapé da tela e em [docs/04](docs/04-game-design.md).

## Critérios de qualidade
Sim pura/determinística (no alvo) · render não decide regra · IA joga pelas mesmas regras · **zero asset de arte** · balanceamento em config testável por seed.

## Instruções para agentes
- **Dono:** `realtime-game-netcode-engineer`. Graduação TS/build/deploy: `deploy-release-manager`.
- Leia [docs/02](docs/02-stack-tecnologica.md) (decisão de engine) e os ADRs antes de propor trocar de stack — a escolha **code-first / zero-modelagem** é deliberada.
- Não introduza dependência de editor visual nem pipeline de assets 3D; não mova regra autoritativa pra render.
