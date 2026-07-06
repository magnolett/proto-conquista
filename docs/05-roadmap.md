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
**Entregue (2026-06-24):** tipos de base (escudo/veloz/canhão), modificadores de mapa (estrada/lamaçal), névoa de guerra (tecla `F`) e cronômetro+placar — determinísticos por seed, com +19 testes (41 no total). *(As pendências "calibração" e "IA vs canhão" foram absorvidas pela F2.5.)*

## F2.5 — Profundidade ESTRATÉGICA ✅ *implementada (2026-07-06; falta calibração humana)*

**Motivação:** playtest do dono na F2 — "o jogo está raso; a estratégia é simples demais". Diagnóstico: informação perfeita + captura 100% previsível + zero contra-jogada ao envio + upgrade instantâneo + IA greedy legível ⇒ a inteligência exigida era aritmética, não estratégica.

**Escopo (tudo com dial em `packages/shared`; valor 0/neutro restaura a regra antiga):**
1. **Upgrade é OBRA** (`UPGRADE`): paga agora, evolui depois; produção parada, canhão inativo, dano ampliado; captura cancela o investimento — greed virou timing attack.
2. **Especialização escolhida** no upgrade (`U` mantém, `Z` escudo, `X` veloz, `C` canhão) — nasce identidade de build; a IA especializa por posição (centro⇒canhão, fronteira⇒escudo, retaguarda⇒veloz).
3. **Interceptação em trânsito** (`ENGAGE`): frotas inimigas que se cruzam brigam (a menor morre, a maior segue com a diferença) — cortar reforço e defesa ativa existem.
4. **Personas de IA por seed** (`PERSONAS`: equilibrada/agressiva/econômica/defensiva, reveladas SÓ no placar final) + **all-in coordenado** (persona coordenada ou hard: bases somam forças contra alvo intomável) + **ciência de canhão** (penaliza rota exposta no score e FLANQUEIA com waypoint).
5. **Névoa LIGADA por padrão** + memória de última visão (ghosts) — scouting é decisão; `F` continua alternando.
6. **Waypoint do jogador**: Shift durante o arrasto fixa um desvio — canhão/lamaçal/estrada viram escolha de rota.
7. **Vitória por DOMÍNIO** (`CORE`): segurar a fortaleza central por N s contínuos vence — força conflito no meio e mata a varredura final.
8. **Neutras crescem** (`NEUTRAL`) até um teto — esperar para expandir custa.
9. **Atrito de suprimento** (`SUPPLY`): frota longe das próprias bases definha — anti-deathball; expandir vira logística.

**Entregue:** 93 testes (52 novos: obra, interceptação, personas, coordenação, canhão/geometria, waypoint, domínio, crescimento, atrito, **smoke de partida completa anti-stall**). **Critério de saída (pendente, humano):** cada mecânica percebida em jogo; 3+ partidas seguidas com decisões *diferentes*; dificuldades e personas distinguíveis às cegas.

## F3 — Apresentação e entrega — *quase completa (2026-07-06)*

**Escopo:** build de produção ✅, deploy web estático ✅ ([magnolett.github.io/proto-conquista](https://magnolett.github.io/proto-conquista/), automático no push), **sons sintetizados Web Audio ✅** (envio/interceptação/captura/obra/alarme de domínio/fim — zero asset, mute `M` persistido, honestos com a névoa: só soa o que você veria), **menu inicial ✅** (mapa congelado ao fundo; clique/Espaço começa; `G`/`R`/`M` no menu) e **onboarding ✅** (4 dicas contextuais só na primeira partida, persistido).
**Critério de saída:** link jogável público ✅; 60 FPS em hardware modesto (medir no overlay `O` — pendente, humano).

### Ferramentas de calibração (2026-07-06)
- **`pnpm balance`** — torneio self-play (IA×IA, 184 partidas em ~1s) → `docs/balance-report.md`; histórico e decisões em [balance-notes-2026-07-06](balance-notes-2026-07-06.md). Primeira calibração aplicada: personas niveladas (36–58%), hard×easy 71%, guarnição inicial 26, domínio 35 s.
- **Goldens CONGELADOS** — `golden-frozen.test.ts` compara cenários canônicos com baselines comitadas (`__goldens__/`); mudança intencional de regra/dial ⇒ `pnpm goldens:update`. `Math.hypot` foi trocado por `sqrt` na sim (bit-determinismo entre engines — pré-requisito do PvP).

## F4+ — Multiplayer e modos (se a diversão sustentar)

**Escopo:** PvP com **servidor autoritativo** (a sim pura da F1 vira a verdade do servidor), escaramuças/campanha, wrapper desktop (Tauri).
**Fora até aqui:** rede, mobile, monetização.

---

## Princípios de sequência

1. **Diversão antes de infra** — não graduar/deployar antes da F0 divertir.
2. **Sim pura antes de multiplayer** — F1 (determinismo + testes) é pré-requisito do PvP autoritativo.
3. **Zero asset de arte em todas as fases** — profundidade e feedback vêm de sistema, forma, luz e som sintetizado.
4. **Todo dial em config**, testável por seed.
