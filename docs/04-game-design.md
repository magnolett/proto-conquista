# 04 — Game Design Document (GDD)

## Conceito

RTS de **conquista de território em tempo real**: o mapa é um grafo de **bases** que produzem tropas; o jogador move **frotas** entre bases pra defender, expandir e atacar. Vitória = eliminar o oponente. Uma partida é uma curva de **macro**: abrir (expandir pra bases neutras) → meio (disputar o centro, economia vs agressão) → fim (concentrar força e quebrar o inimigo).

## Loop de jogo

Produzir → decidir (expandir / reforçar / atacar / evoluir) → enviar frota → resolver chegada → repetir, sob pressão da IA.

## Mecânicas (implementadas)

### Bases
- **Dono:** você (ciano), IA (laranja), neutra (cinza).
- **Produção:** bases possuídas geram tropas até o **teto (cap)**; neutras são **estáticas** (objetivos).
- **Tier (1→3):** sobe **produção, teto e raio**. Custa tropas (tecla `U`). É o eixo **economia vs tempo**: investir agora rende mais depois, mas te deixa vulnerável agora.

### Frotas e combate
- Enviar gasta uma **fração** (25/50/75/100%, teclas 1-4) da guarnição.
- A frota **viaja em velocidade fixa** → distância = atraso (geometria estratégica: flanquear, cortar reforço).
- **Chegada:** reforça (mesma cor) ou ataca (subtrai), virando a base se a defesa zera.

### Controle
- **Arraste** base→base = envio simples.
- **Caixa de seleção + clique** = multi-envio (abrir várias frentes).
- **Clique** numa base = monta grupo de origem.

## Tensões estratégicas (de onde vem a profundidade)

| Tensão | Origem |
|---|---|
| Economia × tempo | Upgrade custa tropas agora por mais produção depois |
| Geometria | Frota em velocidade fixa → reforço distante chega tarde |
| Multi-frente | Multi-seleção permite (e pune) abrir várias frentes |
| Leitura de risco | Atacar neutra forte / centro T3 é caro mas valioso |
| Tempo de reação | A IA reforça o que está sob ameaça — fintar e dividir a atenção dela funciona |

## Mapa

Gerado por partida, **espelhado por simetria de ponto** (partida justa): sua base e a da IA em cantos opostos; uma **base central T3** contestada; pares de neutras de tiers variados. Bases neutras fortes = expansão de alto risco/recompensa.

## Balanceamento (valores atuais — a calibrar)

- Frota: **135 px/s** · Tick da IA: **0,7 s**.
- Tiers — **T1**: prod 1,0/s, cap 30 · **T2**: 1,9/s, cap 58 · **T3**: 3,2/s, cap 95.
- Custo de upgrade: **20 × tier**. Base inicial: **22 tropas**.

> **Tudo provisório.** Calibração é trabalho de playtest (humano) — ajustar `CFG`/`TIERS` em `game.js`.

## Profundidade futura (priorizada, sem exigir arte)

1. **Dificuldades de IA** (tick + agressividade + qualidade de alvo).
2. **Névoa de guerra** (só enxerga perto das suas bases/frotas).
3. **Tipos de base** (canhão = dano à distância · escudo = +defesa · veloz = frota mais rápida) — só cor/forma/ícone.
4. **Cronômetro + pontuação** (modo "partida" com placar).
5. **Modificadores de mapa** (estradas que aceleram, terreno que atrasa).
6. **PvP** (servidor autoritativo) — fase posterior.

## Não-mecânicas (cortes conscientes)

- Sem coleta de múltiplos recursos (só 1 recurso: tropas) — clareza > simulação econômica pesada no protótipo.
- Sem construção livre de bases (mapa fixo por partida) no protótipo.
