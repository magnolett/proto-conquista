# ADR-0001 — Engine e linguagem

**Data:** 2026-06-23
**Status:** aceito
**Contexto:** projeto solo (Marcos) com implementação acelerada por IA (Claude), construído inteiramente em código — sem disposição para usar editores visuais (Unity/Godot) nem para fazer modelagem/arte. Gênero alvo: RTS de conquista de território em tempo real, top-down, partidas curtas. Requisito-chave: **atrito mínimo pra iterar** e máxima sinergia com o fluxo code-first do portfólio (TypeScript em project-football/interregno).

## Decisão

1. **Engine-como-biblioteca, nunca engine-como-aplicativo.** O jogo é um programa com loop `update/draw`; sem editor visual obrigatório, sem cena montada em GUI.
2. **Protótipo em HTML + Canvas 2D + JavaScript, single-file, zero build.** Duplo-clique e joga — o menor atrito possível pra validar a jogabilidade.
3. **Linguagem-alvo: TypeScript** (graduação na F1), alinhada ao resto do workspace.
4. **2D, não 3D** — estratégia top-down lê melhor em 2D e dispensa modelagem.

## Alternativas consideradas

- **Unity / Godot / Unreal:** rejeitados — editor-cêntricos; código é segundo plano; iteração por IA lenta; exigem fluxo de cena/asset que o dono quer evitar.
- **Phaser:** forte candidato (o dono já domina, project-football usa); **adiado** — pro protótipo, Canvas puro tem atrito ainda menor (zero dependência). Reavaliar na graduação se precisarmos de cenas/tilemaps/input prontos.
- **LÖVE/Lua · libGDX/Java · MonoGame/C# · Bevy/Rust:** excelentes engines-como-biblioteca (ver `relatorio-engines-como-biblioteca.md` na Área de Trabalho), mas trocariam a linguagem do portfólio; TS mantém um só modelo mental e sinergia com a IA.
- **3D "cozy" (estilo Tiny Glade):** rejeitado pro escopo — a beleza dele vem de geração procedural + GI sob medida (R&D de gráficos), não de assets; alto custo, contra o pilar "sem arte".

## Consequências

- **Positivas:** atrito zero pra iterar; nenhum pipeline de assets; portátil; caminho de graduação pra TS sem reescrever o conceito; sinergia máxima com construção por IA.
- **Negativas/risco:** JS sem tipos no protótipo (mitigado: escopo pequeno + graduação TS na F1); Canvas puro dá menos "pronto de fábrica" que Phaser (aceito pelo ganho de simplicidade).
- **Reversibilidade:** alta — Canvas→Phaser e JS→TS são incrementais; a lógica de jogo é isolável.

## Pendências

- Confirmar Canvas puro vs Phaser na graduação (F1).
- Pinar versões (Node/TS/Vite) no bootstrap da F1.
