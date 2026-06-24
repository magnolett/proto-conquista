# 01 — Visão, Objetivos e Metas

> Codinome do projeto: **Conquista** (nome comercial a definir).

## Visão

Um RTS de **conquista de território em tempo real**, jogável no navegador desde o dia 1, onde **decisões de macro** (onde produzir, quando expandir, qual frente reforçar, investir em economia ou atacar) importam mais que velocidade de clique. Estética **minimalista e coesa** — formas, cor e luz — que envelhece bem e **não exige nenhuma arte feita à mão**. Partidas curtas contra uma IA que joga de verdade hoje; PvP e campanha depois.

## Pilares de design (inegociáveis)

1. **Decisão > reflexo** — profundidade no sistema (economia/timing/geometria), não em APM.
2. **Zero modelagem** — toda a "arte" é forma + luz + shader/código; se faltar objeto, kit CC0, nunca modelar.
3. **Code-first** — construído inteiramente em código, sem editor visual obrigatório.
4. **Tempo-até-diversão < 30s** — do abrir à primeira frota enviada.
5. **IA honesta** — o oponente joga pelas MESMAS regras (sem visão extra, sem tropa de graça).
6. **Sim determinística (alvo)** — mesma seed + mesmas ações = mesmo resultado; habilita replays e testes.

## Objetivos por horizonte

### Curto prazo (F0–F1)
- Protótipo single-file jogável e divertido contra IA (**feito** — falta balancear).
- Graduar pra TypeScript + Vite com **`packages/sim` determinística pura** separada da render.

### Médio prazo (F2–F3)
- Profundidade: névoa de guerra, dificuldades de IA, tipos de base (canhão/escudo/veloz), cronômetro/pontuação, geração de mapa variada.
- Testes da sim (Vitest + property + golden replays) e build/deploy web estático.

### Longo prazo (F4+)
- PvP (servidor autoritativo reusando a sim pura), campanha/escaramuças, modificadores, e wrapper desktop (Tauri).

## Metas mensuráveis (KPIs)

| KPI | Meta protótipo | Meta v1 |
|---|---|---|
| Tempo do abrir à 1ª frota | < 30s | < 15s |
| Duração de partida | 2–5 min | 3–8 min (configurável) |
| Assets de arte (imagens/modelos) | **0** | **0** |
| Dependências de runtime | 0 | mínimas (Vite/TS são dev-only) |
| FPS em hardware modesto | 60 | 60 |
| Cobertura de testes da sim | — | golden replays + invariantes |

## Não-objetivos (por enquanto)

- Gráficos 3D, modelagem, pipeline de assets, editor visual.
- PvP/rede no protótipo; mobile nativo; monetização.
- Realismo gráfico estilo Tiny Glade (GI fotorrealista é R&D de gráficos de elite — fora de escopo; ver [02-stack-tecnologica](02-stack-tecnologica.md)).

## Riscos principais

| Risco | Mitigação |
|---|---|
| Balanceamento frustrante (IA fácil/difícil, partida arrasta) | `CFG`/`TIERS` em config; playtest dirigido; no alvo, diais testáveis por seed |
| Escopo crescer (3D, rede cedo) | Pilares + não-objetivos escritos; roadmap por fase |
| Acoplar sim e render (dívida do single-file) | F1 separa `packages/sim` puro; render só desenha |
| "Sem arte" parecer pobre | Direção de arte por restrição (1 paleta, formas, luz) — coesão, não quantidade |
