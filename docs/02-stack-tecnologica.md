# 02 — Stack Tecnológica

> Decisão resumida aqui; o comparativo longo de engines está em
> `Área de Trabalho/relatorio-engines-como-biblioteca.md` e a decisão formal em
> [ADR-0001](decisions/ADR-0001-engine-e-linguagem.md).

## Princípio: engine-como-BIBLIOTECA, não engine-como-aplicativo

- **Aplicativo** (Unity/Godot/Unreal): você vive dentro de um editor visual; o código é segundo plano. **Rejeitado** — exige arrastar cenas/assets numa GUI.
- **Biblioteca** (Canvas/Phaser/LÖVE/libGDX/Bevy…): você `import` e escreve um programa com loop `update/draw`; **não há editor**; o jogo é um executável. **Escolhido** — 100% code-first, ideal para construção acelerada por IA.

## Decisão

- **Protótipo:** **HTML + Canvas 2D + JavaScript**, single-file, **zero build / zero dependência** — atrito mínimo pra validar a jogabilidade (duplo-clique e joga).
- **Alvo:** **TypeScript strict + Vite**, monorepo com `packages/sim` determinística pura (ver [03-arquitetura](03-arquitetura.md) e [ADR-0003](decisions/ADR-0003-rts-tempo-real-autoritativo.md)). Mesma linguagem do portfólio (project-football/interregno) → um modelo mental, tipos compartilhados, golden replays.
- **2D, não 3D.** Estratégia top-down lê melhor em 2D e dispensa qualquer modelagem (ver Pilares, [01](01-visao-objetivos.md)).

## Alternativas consideradas

- **Unity / Godot:** rejeitados — editor-cêntricos (engine-como-aplicativo); contra o pilar code-first; iteração por IA muito mais lenta.
- **3D (Bevy/Three.js) p/ um "Tiny Glade":** adiado — a beleza do Tiny Glade vem de **geração procedural + um renderizador de GI sob medida** (R&D de gráficos de elite), não de assets. Fora de escopo; 2D entrega coesão sem esse custo.
- **Phaser (em vez de Canvas puro):** viável e conhecido pelo dono (project-football usa); **adiado** — pro protótipo, Canvas puro tem atrito ainda menor (zero dependência). Phaser volta à mesa se precisarmos de cenas/tilemaps/input prontos ao graduar.
- **LÖVE/Lua · libGDX/Java · MonoGame/C#:** ótimos engines-como-biblioteca (ver relatório), mas trocariam a linguagem do portfólio; TS mantém sinergia com o resto do workspace e com a IA.
- **Empacotamento desktop:** Tauri quando/se sair do navegador — decisão de fase posterior.

## Consequências

- **Positivas:** atrito zero pra iterar agora; caminho claro de graduação pra TS sem reescrever o conceito; nenhum pipeline de assets; portátil (roda em qualquer navegador).
- **Negativas/risco:** o single-file acopla sim e render (dívida deliberada) — paga-se na F1 separando o `packages/sim` puro. JS sem tipos no protótipo — mitigado por escopo pequeno e graduação pra TS.
- **Reversibilidade:** alta — a lógica de jogo é simples e isolável; trocar Canvas→Phaser ou JS→TS é incremental.
