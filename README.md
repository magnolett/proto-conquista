# Conquista *(título provisório)*

RTS de **conquista de território em tempo real** no navegador (estilo **Galcon / Auralux / Nexus Wars**): suas bases produzem tropas, você as envia em frotas que viajam pelo mapa, e captura bases inimigas/neutras quando chega com força maior. Um oponente de IA defende, expande e evolui — **partidas de poucos minutos, decididas por estratégia, não por reflexo**.

**Princípio fundador:** a profundidade vem da **simulação** (economia, timing, geometria, multi-frente) — os gráficos são **formas e luz, zero modelagem**.

## Inspirações
Galcon / Auralux (fluxo de tropas entre nós) · Nexus Wars (macro de produção) · Mini Metro / Into the Breach (beleza minimalista, leitura limpa) · Slay the Spire / Balatro (prova de que estratégia de time pequeno em engine-como-biblioteca vira hit).

## Documentação

| Doc | Conteúdo |
|---|---|
| [01-visao-objetivos](docs/01-visao-objetivos.md) | Visão, pilares de design, objetivos, KPIs, não-objetivos, riscos |
| [02-stack-tecnologica](docs/02-stack-tecnologica.md) | Por que **engine-como-biblioteca / code-first**; comparativo e alternativas descartadas |
| [03-arquitetura](docs/03-arquitetura.md) | Arquitetura do protótipo (loop, estado, sim, render) e a arquitetura-**alvo** (TS + sim pura) |
| [04-game-design](docs/04-game-design.md) | **GDD**: mecânicas, regras, controles, balanceamento e profundidade futura |
| [05-roadmap](docs/05-roadmap.md) | Fases (F0 protótipo → F1 graduação TS → F2 profundidade → …) e critérios de saída |
| [decisions/](docs/decisions/) | **ADRs** — engine/linguagem, arte sem modelagem, RTS tempo real + sim determinística |

## Estado

**Monorepo TypeScript jogável e no ar** ([magnolett.github.io/proto-conquista](https://magnolett.github.io/proto-conquista/)): `packages/sim` (simulação determinística pura, PRNG seedado), `packages/shared` (diais tipados), `apps/web` (Canvas 2D, só render+input). Mapa espelhado, produção por *tier*, frotas com tempo de viagem, captura, multi-seleção, **IA honesta com 3 dificuldades**. **F2:** tipos de base (escudo/veloz/canhão), zonas de mapa (estrada/lamaçal), névoa, cronômetro+placar. **F2.5 (profundidade estratégica):** upgrade é **obra vulnerável** com **especialização à escolha** (`Z`/`X`/`C`) · **interceptação de frotas em trânsito** · IA com **personas por seed** (reveladas só no fim), **all-in coordenado** e **flanqueio de canhões** · **waypoint** (Shift no arrasto) · vitória por **domínio do centro** · neutras que **crescem** · **atrito de suprimento**. **F3:** menu inicial, onboarding e **sons sintetizados** (Web Audio, zero asset, `M`). **F4-lite (iteração pós-playtest):** **mapas densos com 3 layouts** sorteados por seed · **rotas de suprimento** (botão direito arrastado = fluxo automático cortável) · **doutrinas** (poder ativo `[Q]`, escolhido no menu; a IA usa o da persona dela). *(Névoa de guerra foi testada e REMOVIDA — corte consciente.)* **Verificado:** typecheck 0 erros · **106 testes** (goldens congelados + smoke de partida completa) · build + deploy (GitHub Pages) ok. Balance calibrado por **self-play** (`pnpm balance`); refino final é humano.

## Rodando

`pnpm install` na raiz, depois **`pnpm --filter web dev`** (Vite em http://localhost:5173). Testes: `pnpm test` · typecheck: `pnpm typecheck` · build: `pnpm --filter web build`.

### Controles

| Controle | Ação |
|---|---|
| **Arraste** (de uma base sua → qualquer base) | Enviar tropas (ataca inimigo / reforça aliado) |
| **Shift** durante o arraste | Fixa um **desvio** (waypoint): flanquear canhão, surfar estrada, fugir do lamaçal |
| **Botão DIREITO arrastado** (base sua → base aliada) | Liga uma **ROTA de suprimento** (fluxo automático de excedente); direito na própria base/no vazio remove |
| **Caixa de seleção** + clique no alvo | Multi-envio (de várias bases ao mesmo tempo) |
| **Clique** numa base sua | Alterna seleção (montar grupo) |
| **1 / 2 / 3 / 4** | Força do envio (25 / 50 / 75 / 100%) — no **menu**, `1/2/3` escolhem a **doutrina** |
| **U** | Inicia a **obra** de upgrade mantendo a vocação (custa tropas AGORA; a base fica vulnerável) |
| **Z / X / C** | Obra de upgrade **especializando**: escudo / veloz / canhão |
| **Q** | Ativa a sua **doutrina** (Blitz / Muralha / Mobilização — efeito temporário com cooldown) |
| **Espaço** | Pausa |
| **R** / **Shift+R** | Nova partida (nova seed) / mesma seed (replay) |
| **G** | Cicla a dificuldade da IA (fácil / normal / difícil) |
| **M** | Liga/desliga o som (sintetizado, zero asset) |
| **O** · **Tab** · **− / =** | Overlay de debug · seleciona dial · ajusta o dial (playtest) |

## Regras (resumo)
- Suas bases **produzem** tropas até um teto; **tier** maior = mais produção e teto.
- Bases **neutras** crescem devagar até um limite — esperar para expandir **custa**.
- A **frota viaja em velocidade fixa** → a distância importa (reforço chega atrasado). Frotas inimigas que **se cruzam brigam no ar** (a menor morre; a maior segue com a diferença).
- Longe de qualquer base sua, a frota sofre **atrito de suprimento** — ataques profundos pedem bases-ponte.
- **Captura** = chegar com mais tropas que a defesa. Vence quem **eliminar** o outro **ou dominar a fortaleza central** por tempo contínuo (anel de progresso).
- **Upgrade é obra**: paga agora, evolui depois; em obra a base não produz e toma dano ampliado — capturada, o investimento morre. Ao evoluir você **escolhe a vocação** (escudo/veloz/canhão).
- **Tipos de base**: escudo resiste mais · veloz acelera frotas · canhão afina frotas inimigas por perto. **Zonas** aceleram/atrasam.
- **Rotas de suprimento** mantêm o exército fluindo sem microgestão — e viram alvo: o inimigo intercepta o comboio.
- Cada lado tem uma **doutrina** (poder ativo com cooldown): Blitz, Muralha ou Mobilização — o HUD avisa quando a IA ativa a dela.
- O **mapa muda de formato** a cada partida (espalhado, corredor central ou alas) — a geometria é parte da estratégia.
- A **IA joga com uma persona** sorteada por partida (agressiva/econômica/defensiva/equilibrada) — descubra qual é lendo os primeiros movimentos; ela é revelada só no placar final.

## Próximos passos
- **Playtest humano**: calibração fina dos diais (overlay `O` ou `packages/shared`) — depois `pnpm balance` (sanidade IA×IA) e `pnpm goldens:update`.
- **F3 restante:** medir 60 FPS em hardware modesto (overlay `O` mostra FPS).
- **PvP** (F4): servidor autoritativo reusando `packages/sim` — ver [docs/05](docs/05-roadmap.md) e [ADR-0003](docs/decisions/ADR-0003-rts-tempo-real-autoritativo.md).
