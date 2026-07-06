import { MAP_MODS } from '@conquista/shared';
import type { Config, BaseKind } from '@conquista/shared';
import type { Node, Zone } from './types.js';
import { mkNode, hyp } from './helpers.js';
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
export function generateMap(
  rngState: number,
  config: Config,
): { nodes: Node[]; rng: number; zones: Zone[] } {
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
    placed.every((p) => hyp(p.x - x, p.y - y) > minDist) &&
    hyp((W - x) - x, (H - y) - y) > minDist * 0.7;

  // Base do jogador (canto inferior-esquerdo) + espelho = base da IA.
  // Guarnição 26 (era 22): sobreviver ao 1º all-in coordenado — self-play media
  // partidas de 45s sem arco (balance-report 2026-07-06).
  const bx = 120 + rand() * 120;
  const by = H - 140 - rand() * 110;
  nodes.push(mkNode(nodes.length, bx, by, 'you', 0, 26));
  placed.push({ x: bx, y: by });
  const mb = mirror(bx, by);
  nodes.push(mkNode(nodes.length, mb.x, mb.y, 'enemy', 0, 26));
  placed.push(mb);

  // Base central contestada (no eixo de simetria → é o próprio espelho).
  const core = mkNode(nodes.length, cx, cy, 'neutral', 2, 42, 'shield'); // fortaleza central
  core.isCore = true; // segurá-la por CORE.holdSeconds vence por DOMÍNIO (F2.5)
  nodes.push(core);
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
    if (!placed.every((p) => hyp(p.x - m.x, p.y - m.y) > minDist)) continue;
    // short-circuit idêntico ao game.js: o 2º rand() só corre se o 1º falhar.
    const tier = rand() < 0.25 ? 2 : rand() < 0.5 ? 1 : 0;
    const def = tier === 2 ? 36 : tier === 1 ? 20 : 9;
    // Especialidade sorteada do PRNG, IGUAL nos dois nós do par (mantém a simetria/justiça).
    const kr = rand();
    const kind: BaseKind = kr < 0.25 ? 'cannon' : kr < 0.5 ? 'shield' : kr < 0.75 ? 'fast' : 'normal';
    nodes.push(mkNode(nodes.length, x, y, 'neutral', tier, def, kind));
    placed.push({ x, y });
    nodes.push(mkNode(nodes.length, m.x, m.y, 'neutral', tier, def, kind));
    placed.push(m);
    made++;
  }

  // Zonas modificadoras (F2): pares espelhados — estrada (acelera) + lamaçal (atrasa).
  const zones: Zone[] = [];
  const addZonePair = (speedMul: number, radius: number): void => {
    const zx = 200 + rand() * (W - 400);
    const zy = 150 + rand() * (H - 300);
    zones.push({ x: zx, y: zy, radius, speedMul });
    const zm = mirror(zx, zy);
    zones.push({ x: zm.x, y: zm.y, radius, speedMul });
  };
  addZonePair(MAP_MODS.roadSpeedMul, MAP_MODS.roadRadius);
  addZonePair(MAP_MODS.mudSpeedMul, MAP_MODS.mudRadius);

  return { nodes, rng, zones };
}
