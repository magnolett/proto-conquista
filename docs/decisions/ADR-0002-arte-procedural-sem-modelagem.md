# ADR-0002 — Arte procedural, zero modelagem

**Data:** 2026-06-23
**Status:** aceito
**Contexto:** o dono **não faz e não quer fazer** arte/modelagem (sempre detestou), e quer que a IA elimine essa preocupação. A IA (Claude) gera **código**, não imagens nem modelos 3D — logo, a estratégia de "arte" precisa ser code-first. Observação de mercado: jogos minimalistas (Thomas Was Alone, Mini Metro, Into the Breach) e o uso de shaders (Balatro) provam que **coesão vem de restrição, não de quantidade de assets**.

## Decisão

1. **Zero asset de arte feito à mão.** Nenhuma modelagem 3D, nenhum sprite desenhado manualmente.
2. **A "arte" é geometria + cor + luz + (futuro) shader**, tudo gerado em código. Bases = círculos com *glow*; frotas = setas; estado = número/cor/anel.
3. **Direção por restrição:** uma paleta coesa (ciano / laranja / cinza sobre fundo escuro-azulado), uma linguagem de formas, uma luz. Coesão > realismo.
4. **Se algum dia precisar de "objeto":** usar **kits CC0 prontos** (Kenney/Quaternius) — compor, **nunca modelar**. Som: síntese / Web Audio, não samples autorais.
5. **Meta honesta:** "coeso e charmoso", **não** fotorrealismo (GI estilo Tiny Glade é R&D de gráficos, fora de escopo).

## Alternativas consideradas

- **Gerar modelos 3D por IA (Meshy/Tripo/etc.):** rejeitado pro escopo — saída com topologia "suja", precisa retoque; não é drop-in; e puxaria o projeto pra 3D sem necessidade.
- **Comprar/baixar packs de sprites 2D:** desnecessário pro estilo geométrico atual; fica como recurso futuro (kits CC0) se um tipo de base pedir ícone.
- **Estilo pixel-art desenhado:** rejeitado — reintroduz exatamente o trabalho de arte que o dono quer evitar.

## Consequências

- **Positivas:** o dono nunca precisa abrir editor de arte; a IA entrega 100% do visual em código; visual coeso e leve; portátil e performático.
- **Negativas/risco:** teto de "espetáculo" mais baixo que arte autoral — **mitigado** por direção forte (paleta/luz/forma) e, depois, shaders e feedback ("game juice"). Risco de "parecer pobre" se a restrição não for caprichada → tratar paleta/luz como decisão de design, não acaso.
- **Reversibilidade:** total — nada impede adicionar kits CC0 ou shaders depois; nenhuma decisão de arte é destrutiva.

## Pendências

- Definir paleta / escala de luz como tokens nomeados ao graduar (hoje em `COL` no `game.js`).
- Avaliar uma camada de shader / post-fx ("juice") na F3.
