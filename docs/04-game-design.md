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

### Profundidade F2.5 — estratégica (implementada 2026-07-06)
- **Upgrade é OBRA:** paga agora, evolui após `timePerTier×nível` s; durante a obra a produção PARA, o canhão cala e a base toma dano ampliado (escudo perde a proteção); captura no meio **cancela o investimento**. Atacar quem evolui é jogar bem.
- **Especialização escolhida:** ao evoluir, o dono escolhe a vocação — `U` mantém, `Z` escudo, `X` veloz, `C` canhão. Capturar neutra especial é o atalho barato; construir é o caminho caro e seguro.
- **Interceptação em trânsito:** frotas de donos diferentes que se cruzam brigam no ar — a menor morre, a maior segue com a diferença. Cortar reforço, escoltar e defender ativamente existem; "defesa+ε" deixou de ser garantia.
- ~~Névoa de guerra~~ — **REMOVIDA (playtest 2026-07-06)**: implementação confusa/bugada e ruim de jogar; informação aberta é o padrão Galcon. Corte consciente.
- **Waypoint (Shift no arrasto):** fixa um ponto de passagem — flanquear canhão pagando distância, surfar estrada, evitar lamaçal.
- **Domínio do centro:** segurar a fortaleza central por `CORE.holdSeconds` contínuos **vence a partida** (anel de progresso no mapa). O meio do mapa é obrigatório.
- **Neutras crescem** devagar até um teto: expandir cedo é mais barato que expandir depois.
- **Atrito de suprimento:** frota a mais de `SUPPLY.range` de qualquer base sua definha — ataques profundos exigem bases-ponte (logística é estratégia).
- **IA com personas** (sorteada por seed; revelada só no placar): **agressiva** (rush, anti-jogador), **econômica** (upa e expande), **defensiva** (segura e contra-ataca em massa), **equilibrada**. Personas coordenadas (e o hard sempre) fazem **all-in combinado** quando nenhum alvo é tomável sozinho; a IA também **penaliza rotas sob canhão e flanqueia com waypoint** — e caça bases em obra.

### Profundidade F4-lite (implementada 2026-07-06 — iteração 2 pós-playtest)
- **Mapa DENSO com layouts** (`MAPGEN`): ~7 pares de neutras (17 nós) e formato sorteado por seed — *classic* (espalhado), *lanes* (corredor entre as capitais), *flanks* (alas norte/sul, miolo vazio). Mais frentes simultâneas; a geometria muda a partida.
- **Rotas de suprimento** (`ROUTE`, botão DIREITO arrastado): a origem envia automaticamente parte do excedente ao destino aliado a cada ciclo — o jogo vira desenhar uma REDE logística; a frota da rota é normal (viaja, engaja, sofre atrito) e o inimigo pode CORTÁ-LA. Botão direito na própria base/no vazio remove; obra pausa o fluxo; destino perdido mata a rota.
- **Doutrinas** (`DOCTRINES`, escolha no menu `[1/2/3]`, ativação `[Q]`): poder temporário com cooldown — **Blitz** (frotas +60% por 8s), **Muralha** (bases −45% de dano por 6s), **Mobilização** (produção +50% por 8s). A IA usa a doutrina da persona pela mesma regra (agressiva=Blitz, defensiva=Muralha, econômica=Mobilização) e ativa no momento certo (ataque no ar / onda vindo / paz). Timing de "ult" + leitura do poder inimigo (alarme no HUD quando a IA ativa).

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

- Frota: **135 px/s** · Tick da IA: **0,7 s** (×persona; fácil pensa a 1,4 s).
- Tiers — **T1**: prod 1,0/s, cap 30 · **T2**: 1,9/s, cap 58 · **T3**: 3,2/s, cap 95.
- Custo de upgrade: **20 × tier**. Base inicial: **26 tropas** (sobrevive ao 1º all-in).
- **F2 — tipos:** escudo dano ×0,6 · veloz ×1,6 · canhão alcance 110 / 6 dps. **Mapa:** estrada ×1,5 · lamaçal ×0,6. **Névoa:** raio 230. **Placar:** base×100 · tier×50.
- **F2.5 — obra:** 6 s/nível · vulnerabilidade ×1,3. **Interceptação:** raio 16. **Domínio:** 35 s. **Neutras:** +0,12/s até 40. **Atrito:** 2%/s além de 430 px. **IA:** defesa 0,82 · dreno 0,6 · pesos buildTarget 30 / core 45 / canhão 1,0 / suprimento 0,08 · personas em `PERSONAS`.
- **F4-lite — mapa:** 7 pares de neutras · minDist 104 · 3 pares de zonas. **Rota:** ciclo 3,5 s · 35% do excedente · reserva 12. **Doutrinas:** Blitz ×1,6/8s/cd45 · Muralha ×0,55/6s/cd45 · Mobilização ×1,5/8s/cd55.
- Valores pós **calibração por self-play** (`pnpm balance` + sondas): ver [balance-notes-2026-07-06](balance-notes-2026-07-06.md) — mediana de partida ~1:24 (tinha arco?✓), Mobilização nerfada de 76% de winrate, refino final é playtest humano.

> **Tudo provisório.** Calibração é trabalho de playtest (humano) — ajustar os diais em `packages/shared` (`CFG`/`TIERS`/`BASE_KINDS`/`MAP_MODS`/…) ou em runtime no overlay (`O` + `Tab`/`-`/`=`).

## Profundidade — status (F2 + F2.5 implementadas)

1. ✅ **Dificuldades de IA** (tick + agressividade + qualidade de alvo) — F2.5: × **personas** por seed.
2. ✅ **Névoa de guerra** — F2.5: **ligada por padrão**, com memória de última visão.
3. ✅ **Tipos de base** — F2.5: especialização **escolhida** no upgrade (`Z`/`X`/`C`).
4. ✅ **Cronômetro + pontuação** — F2.5: + vitória por **domínio do centro**.
5. ✅ **Modificadores de mapa** — F2.5: rota virou decisão (**waypoint** Shift).
6. ✅ **Obra vulnerável** · ✅ **interceptação em trânsito** · ✅ **neutras crescem** · ✅ **atrito de suprimento** · ✅ IA **coordena all-in** e **flanqueia canhões**.

**A seguir:** calibração humana de TODOS os diais (F2+F2.5); F3 (som sintetizado Web Audio, menu/opções); **PvP** com servidor autoritativo reusando `packages/sim` (fase posterior).

## Não-mecânicas (cortes conscientes)

- Sem coleta de múltiplos recursos (só 1 recurso: tropas) — clareza > simulação econômica pesada no protótipo.
- Sem construção livre de bases (mapa fixo por partida) no protótipo.
