# Frente 3 — Migração para monorepo TypeScript (status)

Branch: `frente3-ts`. Porte completo do gameplay de `game.js` para um monorepo
pnpm + Vite + TypeScript strict + Vitest, com a sim determinística PURA separada
da render e a IA já no **estado final do contrato de costuras**.

## O que foi entregue

- **`packages/shared`** — `CFG`, `TIERS`, `DIFFICULTY` (valores EXATOS do contrato),
  `upgradeCost`, e tipos compartilhados (`Owner`, `Difficulty`, `Config`, etc.).
- **`packages/sim`** — simulação determinística sem DOM/canvas:
  - PRNG `mulberry32` com **estado inteiro guardado no `GameState`** e avanço PURO
    (`nextRng`), idêntico bit-a-bit à closure de referência (testado).
  - `createInitialState(seed, opts)` + `step(state, inputs, dt)`: economia,
    movimento de frotas, combate na chegada (reforço/ataque/captura), upgrade,
    **IA com FIX da superinvestida + DIFFICULTY**, vitória/derrota.
  - Geração de mapa espelhada por seed (mundo lógico fixo `worldW×worldH`).
- **`apps/web`** — Vite + Canvas 2D: SÓ render + input consumindo a sim. Bases com
  glow, frotas como setas, guias, HUD, banner de vitória; arraste base→base, caixa
  de seleção + clique, teclas 1-4/U/R/Espaço, **seed visível**, **Shift+R** (mesma
  seed), **G** (cicla dificuldade).
- **Testes (Vitest + fast-check)** em `packages/sim`: conservação de tropas,
  regra de captura, **golden replay** (determinismo), equivalência do PRNG, e a IA
  (FIX committed + determinismo).

## Números reais (rodados)

- `pnpm install`: ok (4 workspace projects).
- `pnpm run typecheck` (`tsc -b`): **0 erros**.
- `pnpm run test` (`vitest run`): **21 testes, 21 passando** (5 arquivos).
- `pnpm --filter web build`: ok (13 módulos, ~12,3 kB JS).
- `pnpm --filter web dev`: sobe em **http://localhost:5173/**.

## O que ficou STUB / fora de escopo (por prioridade do briefing)

- **Overlay de debug / edição de "diais" (CFG/TIERS/DIFFICULTY) em runtime**: NÃO
  implementado. A Frente 1 porta a versão completa depois. Hoje os diais são
  constantes tipadas em `packages/shared`; mudar exige recarregar.
- **Sem painel de seleção de dificuldade na UI** além da tecla `G` (cicla
  easy→normal→hard e reinicia com a mesma seed). Suficiente p/ jogar/testar.
- **`game.js` / `index.html` originais preservados** na raiz (depreciação é etapa
  do orquestrador, não desta frente).
- Sem persistência de seed/replay em arquivo, sem fog of war, sem tipos de base —
  são itens de roadmap (docs/04, docs/05).

## Adaptações que o contrato exigiu em TS

- **PRNG no State**: o estado `a` do mulberry32 vive como `rng: number` no
  `GameState`; `step`/IA/mapgen avançam via `nextRng(a) → { value, state }` (puro),
  garantindo `step` snapshotável. A closure `mulberry32` do contrato fica como
  referência e é validada por teste de equivalência.
- **Mundo lógico fixo**: `game.js` gerava o mapa com `innerWidth/innerHeight`
  (não-determinístico). Movido p/ `CFG.worldW/worldH` (1280×720); a render faz
  fit+letterbox e converte o mouse de volta p/ coords de mundo.
- **IA estado final**: atacantes por `cap*expandThresh`, força `floor(troops*expandForce)`,
  score com `tierW/distW/antiPlayerW`, upgrade com `prng < upgradeChance`, e o
  **FIX committed[]** (soma das frotas da IA já mirando cada nó, inclusive as em
  voo, p/ não superinvestir). A IA só lê estado público.
- **Inputs do jogador como dado**: `sendFrom`/`upgradeNode` (que no protótipo
  rodavam em event handlers) viraram `Inputs { sends, upgrades }` aplicados no
  início do `step` — a render só preenche, a sim decide.
