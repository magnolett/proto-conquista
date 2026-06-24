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

### Profundidade F2 (implementada)
- **Tipos de base** (cor+forma, zero asset): **escudo** absorve parte do dano (mais caro de tomar) · **veloz** lança frotas mais rápidas · **canhão** afina frotas inimigas que cruzam seu alcance. Sorteados no mapgen de forma espelhada; base central = fortaleza escudo. Canhão neutro atira nos dois lados (território perigoso de cercar).
- **Modificadores de mapa:** zonas de **estrada** (acelera) e **lamaçal** (atrasa) a frota, espelhadas — geometria de rota mais rica.
- **Névoa de guerra** (tecla `F`): você só enxerga a força de bases/frotas perto das suas; o resto fica oculto (`?`). Afeta só sua visão — a IA segue honesta.
- **Cronômetro + placar:** relógio no HUD e pontuação (bases·tropas·tiers) no fim da partida.

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
- **F2 — tipos:** escudo dano ×0,6 · veloz ×1,6 · canhão alcance 110 / 6 dps. **Mapa:** estrada ×1,5 · lamaçal ×0,6. **Névoa:** raio 230. **Placar:** base×100 · tier×50.

> **Tudo provisório.** Calibração é trabalho de playtest (humano) — ajustar os diais em `packages/shared` (`CFG`/`TIERS`/`BASE_KINDS`/`MAP_MODS`/…) ou em runtime no overlay (`O` + `Tab`/`-`/`=`).

## Profundidade — status (F2 implementada)

1. ✅ **Dificuldades de IA** (tick + agressividade + qualidade de alvo).
2. ✅ **Névoa de guerra** (só enxerga perto das suas bases/frotas; tecla `F`).
3. ✅ **Tipos de base** (canhão = afina frotas no alcance · escudo = +defesa · veloz = frota mais rápida) — só cor/forma.
4. ✅ **Cronômetro + pontuação** (placar no fim da partida).
5. ✅ **Modificadores de mapa** (estradas que aceleram, lamaçal que atrasa).

**A seguir:** calibração humana dos diais F2; IA evitar o alcance de canhões ao rotear (hoje entende escudo, mas não desvia de canhão); modo "tempo-limite"; **PvP** com servidor autoritativo reusando `packages/sim` (fase posterior).

## Não-mecânicas (cortes conscientes)

- Sem coleta de múltiplos recursos (só 1 recurso: tropas) — clareza > simulação econômica pesada no protótipo.
- Sem construção livre de bases (mapa fixo por partida) no protótipo.
