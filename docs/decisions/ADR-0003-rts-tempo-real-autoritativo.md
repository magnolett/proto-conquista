# ADR-0003 — RTS em tempo real com simulação determinística

**Data:** 2026-06-23
**Status:** aceito (gênero) · proposto (graduação técnica)
**Contexto:** o dono pediu, explicitamente, **estratégia em tempo real / partidas com profundidade**, não um jogo de reflexo (protótipos "Neon" anteriores eram divertidos mas rasos). Precisamos fixar o gênero e a arquitetura-alvo que sustenta profundidade e um futuro PvP — aproveitando a competência do portfólio em **simulação determinística pura** (interregno `packages/sim`, project-football `packages/shared`).

## Decisão

1. **Gênero: RTS de conquista de território em tempo real** (linhagem Galcon/Auralux/Nexus Wars). Profundidade vem de **macro** (economia, timing, geometria, multi-frente), não de micro/APM.
2. **IA honesta** — joga pelas mesmas regras (sem visão extra, sem tropas grátis). Dificuldade por parâmetros (tick / agressividade / qualidade de alvo), não por trapaça.
3. **Arquitetura-alvo (F1): simulação determinística pura** em `packages/sim`:
   - Sem `Math.random` / `Date.now` / float não-determinístico; **PRNG seedado e clock injetados**.
   - **Render nunca decide regra** (lição cara do project-football: bug visual ≠ bug de sim).
   - Output testável: **golden replays por seed** + invariantes (conservação de tropas, captura) via Vitest + fast-check.
4. **PvP depois (F4)** reusa a MESMA sim pura como **servidor autoritativo** — daí o investimento em determinismo na F1.

## Alternativas consideradas

- **RTS por turnos (estilo Into the Breach):** ótimo e ainda mais "à prova de arte", mas o dono pediu **tempo real**; turnos fica como modo/variante futura.
- **Shooter/ação (linha "Neon"):** rejeitado — é exatamente o que o dono quer superar em profundidade.
- **Manter single-player local pra sempre (sem sim pura):** rejeitado — fecharia a porta do PvP e dos testes por replay; o determinismo é barato agora e caro de adicionar depois.
- **Framework de netcode pronto (Colyseus) já no protótipo:** adiado (YAGNI) — só faz sentido a partir da F4; agora seria lock-in sem ganho.

## Consequências

- **Positivas:** profundidade alinhada ao pedido; sim pura habilita replays, testes por seed e PvP autoritativo no futuro com uma só implementação.
- **Negativas/risco:** disciplina de determinismo (proibir float/`Math.random` na sim) — mitigada por lint rule e testes; o protótipo atual **ainda não** é determinístico (usa `Math.random`/`performance.now`) → dívida explícita da F1.
- **Reversibilidade:** o gênero é a decisão menos trocável; a stack (ver [02-stack-tecnologica](../02-stack-tecnologica.md)) é altamente reversível.

## Pendências

- F1: extrair `packages/sim` puro + PRNG seedado + golden replays.
- Definir os parâmetros de dificuldade da IA (F2).
