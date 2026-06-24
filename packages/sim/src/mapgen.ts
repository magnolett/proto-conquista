import type { Config } from '@conquista/shared';
import type { Node } from './types.js';
import { mkNode } from './helpers.js';
import { nextRng } from './prng.js';

/**
 * Gera o mapa de forma DETERMINÍSTICA a partir do estado do PRNG.
 *
 * Porte fiel de newMatch() do game.js, com duas mudanças obrigatórias:
 *  1. usa worldW/worldH (mundo lógico fixo) no lugar de innerWidth/innerHeight,
 *     para que a geração não dependa do tamanho da janela;
 *  2. cada Math.random() vira um avanço PURO do PRNG (nextRng), preservando a
 *     ORDEM e a quantidade de saques — inclusive o short-circuit do tier.
 *
 * Retorna os nós criados e o estado final do PRNG.
 */
export function generateMap(rngState: number, config: Config): { nodes: Node[]; rng: number } {
  const W = config.worldW;
  const H = config.worldH;
  const cx = W / 2;
  const cy = H / 2;
  const mirror = (x: number, y: number) => ({ x: W - x, y: H - y });

  const nodes: Node[] = [];
  const placed: Array<{ x: number; y: number }> = [];
  const minDist = 115;

  let rng = rngState;
  // Saca um valor do PRNG, avançando o estado local.
  const rand = (): number => {
    const r = nextRng(rng);
    rng = r.state;
    return r.value;
  };

  const farEnough = (x: number, y: number): boolean =>
    placed.every((p) => Math.hypot(p.x - x, p.y - y) > minDist) &&
    Math.hypot((W - x) - x, (H - y) - y) > minDist * 0.7;

  // Base do jogador (canto inferior-esquerdo) + espelho = base da IA.
  const bx = 120 + rand() * 120;
  const by = H - 140 - rand() * 110;
  nodes.push(mkNode(nodes.length, bx, by, 'you', 0, 22));
  placed.push({ x: bx, y: by });
  const mb = mirror(bx, by);
  nodes.push(mkNode(nodes.length, mb.x, mb.y, 'enemy', 0, 22));
  placed.push(mb);

  // Base central contestada (no eixo de simetria → é o próprio espelho).
  nodes.push(mkNode(nodes.length, cx, cy, 'neutral', 2, 42));
  placed.push({ x: cx, y: cy });

  // Pares de bases neutras espelhadas.
  let made = 0;
  let tries = 0;
  while (made < 4 && tries < 500) {
    tries++;
    const x = 140 + rand() * (W - 280);
    const y = 120 + rand() * (H - 240);
    if (((x - cx) + (y - cy)) > -40) continue; // manter no lado do jogador p/ espelhar
    if (!farEnough(x, y)) continue;
    const m = mirror(x, y);
    if (!placed.every((p) => Math.hypot(p.x - m.x, p.y - m.y) > minDist)) continue;
    // short-circuit idêntico ao game.js: o 2º rand() só corre se o 1º falhar.
    const tier = rand() < 0.25 ? 2 : rand() < 0.5 ? 1 : 0;
    const def = tier === 2 ? 36 : tier === 1 ? 20 : 9;
    nodes.push(mkNode(nodes.length, x, y, 'neutral', tier, def));
    placed.push({ x, y });
    nodes.push(mkNode(nodes.length, m.x, m.y, 'neutral', tier, def));
    placed.push(m);
    made++;
  }

  return { nodes, rng };
}
