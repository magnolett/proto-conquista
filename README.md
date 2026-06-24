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

**Monorepo TypeScript jogável** (pnpm + Vite + TS strict): `packages/sim` (simulação determinística pura, PRNG seedado), `packages/shared` (diais tipados), `apps/web` (Canvas 2D, só render+input). Mapa espelhado (partida justa), produção por *tier*, frotas com tempo de viagem, captura de bases, multi-seleção, **IA honesta com 3 dificuldades** + overlay de playtest. **Verificado:** typecheck 0 erros · **22 testes** (Vitest, golden replays) · build web ok. Graduado do protótipo single-file (F0→F1); falta playtest/balanceamento humano e deploy.

## Rodando

`pnpm install` na raiz, depois **`pnpm --filter web dev`** (Vite em http://localhost:5173). Testes: `pnpm test` · typecheck: `pnpm typecheck` · build: `pnpm --filter web build`.

### Controles

| Controle | Ação |
|---|---|
| **Arraste** (de uma base sua → qualquer base) | Enviar tropas (ataca inimigo / reforça aliado) |
| **Caixa de seleção** + clique no alvo | Multi-envio (de várias bases ao mesmo tempo) |
| **Clique** numa base sua | Alterna seleção (montar grupo) |
| **1 / 2 / 3 / 4** | Força do envio (25 / 50 / 75 / 100%) |
| **U** | Upgrade da(s) base(s) selecionada(s) — custa tropas, sobe produção e teto |
| **Espaço** | Pausa |
| **R** / **Shift+R** | Nova partida (nova seed) / mesma seed (replay) |
| **G** | Cicla a dificuldade da IA (fácil / normal / difícil) |
| **O** · **Tab** · **− / =** | Overlay de debug · seleciona dial · ajusta o dial (playtest) |

## Regras (resumo)
- Suas bases **produzem** tropas até um teto; **tier** maior = mais produção e teto.
- Bases **neutras** não produzem até serem capturadas (são objetivos).
- A **frota viaja em velocidade fixa** → a distância importa (reforço chega atrasado).
- **Captura** = chegar com mais tropas que a defesa. Vence quem eliminar o outro.

## Próximos passos
- **Playtest + balanceamento** (humano): ajustar os diais em runtime (overlay `O` + `Tab`/`-`/`=`) ou em `packages/shared`.
- **Profundidade** (F2, [docs/04](docs/04-game-design.md)): névoa de guerra, tipos de base (canhão/escudo/veloz), cronômetro/pontuação, modificadores de mapa.
- **Deploy** (F3): build estático público; depois PvP autoritativo (F4) reusando `packages/sim` — ver [docs/05](docs/05-roadmap.md) e [ADR-0003](docs/decisions/ADR-0003-rts-tempo-real-autoritativo.md).
