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

**Protótipo single-file jogável** (`index.html` + `game.js`, Canvas 2D, JS puro, **zero build**). Mapa espelhado (partida justa), produção por *tier*, frotas com tempo de viagem, captura de bases, multi-seleção, e **IA que defende/expande/evolui**. Sintaxe validada (`node --check`); **falta playtest/balanceamento** (humano) e a graduação pra TS+Vite com sim determinística.

## Rodando

**Duplo-clique no `index.html`** — abre no navegador, sem instalação. (Se o navegador bloquear o script local, use o Live Server do VS Code.)

### Controles

| Controle | Ação |
|---|---|
| **Arraste** (de uma base sua → qualquer base) | Enviar tropas (ataca inimigo / reforça aliado) |
| **Caixa de seleção** + clique no alvo | Multi-envio (de várias bases ao mesmo tempo) |
| **Clique** numa base sua | Alterna seleção (montar grupo) |
| **1 / 2 / 3 / 4** | Força do envio (25 / 50 / 75 / 100%) |
| **U** | Upgrade da(s) base(s) selecionada(s) — custa tropas, sobe produção e teto |
| **Espaço** | Pausa |
| **R** | Reinicia a partida |

## Regras (resumo)
- Suas bases **produzem** tropas até um teto; **tier** maior = mais produção e teto.
- Bases **neutras** não produzem até serem capturadas (são objetivos).
- A **frota viaja em velocidade fixa** → a distância importa (reforço chega atrasado).
- **Captura** = chegar com mais tropas que a defesa. Vence quem eliminar o outro.

## Próximos passos
- **Playtest + balanceamento** (humano): ajustar `CFG`/`TIERS` em `game.js`.
- **Graduar** pra TypeScript + Vite com `packages/sim` determinística (golden replays / testes por seed) — ver [docs/05](docs/05-roadmap.md) e [ADR-0003](docs/decisions/ADR-0003-rts-tempo-real-autoritativo.md).
- **Profundidade** ([docs/04](docs/04-game-design.md)): névoa de guerra, dificuldades de IA, tipos de base, cronômetro/pontuação.
