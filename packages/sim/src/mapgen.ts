import { MAP_MODS, MAPGEN } from '@conquista/shared';
import type { Config, BaseKind, MapLayout } from '@conquista/shared';
import type { Node, Zone } from './types.js';
import { mkNode, hyp } from './helpers.js';
import { nextRng } from './prng.js';

/**
 * Gera o mapa de forma DETERMINÍSTICA a partir do estado do PRNG.
 *
 * F4-lite: mapas mais DENSOS (MAPGEN.neutralPairs) e com LAYOUT sorteado por
 * seed — a geometria muda a estratégia da partida:
 *  - classic: neutras espalhadas (o clássico Galcon);
 *  - lanes:   neutras puxadas p/ o corredor entre as duas capitais (choque frontal,
 *             canhões e zonas viram pedágio de corredor);
 *  - flanks:  o miolo vertical fica vazio — a riqueza está nas ALAS norte/sul
 *             (partida de pinça, atrito importa nas voltas longas).
 *
 * Cada Math.random() do protótipo virou um avanço PURO do PRNG (nextRng),
 * e o mundo lógico é fixo (worldW×worldH) — mesma seed, mesmo mapa, sempre.
 */
export function generateMap(
  rngState: number,
  config: Config,
  enemyCount: 1 | 2 | 3 = 1,
): { nodes: Node[]; rng: number; zones: Zone[]; layout: MapLayout } {
  const W = config.worldW;
  const H = config.worldH;
  const cx = W / 2;
  const cy = H / 2;
  const mirror = (x: number, y: number) => ({ x: W - x, y: H - y });

  const nodes: Node[] = [];
  const placed: Array<{ x: number; y: number }> = [];
  const minDist = MAPGEN.minDist;

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

  // Layout da partida (F4-lite): sorteado ANTES das posições.
  const lr = rand();
  const layout: MapLayout = lr < 1 / 3 ? 'classic' : lr < 2 / 3 ? 'lanes' : 'flanks';

  // Capital do jogador (canto inferior-esquerdo, com jitter).
  // Guarnição 26 (era 22): sobreviver ao 1º all-in coordenado — self-play media
  // partidas de 45s sem arco (balance-report 2026-07-06).
  const bx = 200 + rand() * 200;
  const by = H - 260 - rand() * 180;
  nodes.push(mkNode(nodes.length, bx, by, 'you', 0, 26));
  placed.push({ x: bx, y: by });

  if (enemyCount === 1) {
    // 1v1 clássico: capital da IA = espelho perfeito (justiça por simetria).
    const mb = mirror(bx, by);
    nodes.push(mkNode(nodes.length, mb.x, mb.y, 'enemy', 0, 26));
    placed.push(mb);
  } else {
    // FFA (F5-lite): capitais nos cantos restantes, com jitter próprio.
    // 'enemy' fica no canto OPOSTO; e2/e3 nos cantos laterais.
    const corners: Array<[number, number, number, number]> = [
      [W - 400, 200, W - 200, 380], // superior-direito (enemy — oposto)
      [200, 200, 400, 380], // superior-esquerdo (e2)
      [W - 400, H - 380, W - 200, H - 200], // inferior-direito (e3)
    ];
    const ids = ['enemy', 'e2', 'e3'] as const;
    for (let i = 0; i < enemyCount; i++) {
      const [x0, y0, x1, y1] = corners[i]!;
      const ex = x0 + rand() * (x1 - x0);
      const ey = y0 + rand() * (y1 - y0);
      nodes.push(mkNode(nodes.length, ex, ey, ids[i]!, 0, 26));
      placed.push({ x: ex, y: ey });
    }
  }

  // Base central contestada (fortaleza do DOMÍNIO — F2.5).
  const core = mkNode(nodes.length, cx, cy, 'neutral', 2, 42, 'shield');
  core.isCore = true;
  nodes.push(core);
  placed.push({ x: cx, y: cy });

  // Filtro geométrico do layout: aceita/rejeita posições candidatas de neutras.
  // A "espinha" é a reta capital-do-jogador → CENTRO (vale p/ 1v1 e FFA).
  const distToSpine = (x: number, y: number): number => {
    const dx = cx - bx;
    const dy = cy - by;
    const len = hyp(dx, dy) || 1;
    return Math.abs((x - bx) * (dy / len) - (y - by) * (dx / len));
  };
  const fitsLayout = (x: number, y: number): boolean => {
    if (layout === 'lanes') return distToSpine(x, y) < 300;
    if (layout === 'flanks') return Math.abs(y - cy) > 240 || distToSpine(x, y) < 110;
    return true; // classic: espalhado
  };

  const rollTierKind = (): { tier: number; def: number; kind: BaseKind } => {
    // short-circuit idêntico ao game.js: o 2º rand() só corre se o 1º falhar.
    const tier = rand() < 0.25 ? 2 : rand() < 0.5 ? 1 : 0;
    const def = tier === 2 ? 36 : tier === 1 ? 20 : 9;
    const kr = rand();
    const kind: BaseKind =
      kr < 0.25 ? 'cannon' : kr < 0.5 ? 'shield' : kr < 0.75 ? 'fast' : 'normal';
    return { tier, def, kind };
  };

  if (enemyCount === 1) {
    // 1v1: PARES de neutras espelhadas (justiça por simetria).
    let made = 0;
    let tries = 0;
    while (made < MAPGEN.neutralPairs && tries < 2400) {
      tries++;
      const x = 220 + rand() * (W - 440);
      const y = 200 + rand() * (H - 400);
      if (((x - cx) + (y - cy)) > -60) continue; // lado do jogador p/ espelhar
      if (!fitsLayout(x, y)) continue;
      if (!farEnough(x, y)) continue;
      const m = mirror(x, y);
      if (!placed.every((p) => hyp(p.x - m.x, p.y - m.y) > minDist)) continue;
      const { tier, def, kind } = rollTierKind();
      nodes.push(mkNode(nodes.length, x, y, 'neutral', tier, def, kind));
      placed.push({ x, y });
      nodes.push(mkNode(nodes.length, m.x, m.y, 'neutral', tier, def, kind));
      placed.push(m);
      made++;
    }
  } else {
    // FFA: neutras espalhadas SEM espelho (posição é parte do jogo num FFA),
    // mantendo folga extra das capitais.
    const capitals = placed.slice(0, enemyCount + 1);
    const total = MAPGEN.neutralsPerRival * (enemyCount + 1);
    let made = 0;
    let tries = 0;
    while (made < total && tries < 4000) {
      tries++;
      const x = 220 + rand() * (W - 440);
      const y = 200 + rand() * (H - 400);
      if (!fitsLayout(x, y)) continue;
      if (!farEnough(x, y)) continue;
      if (!capitals.every((c) => hyp(c.x - x, c.y - y) > 260)) continue;
      const { tier, def, kind } = rollTierKind();
      nodes.push(mkNode(nodes.length, x, y, 'neutral', tier, def, kind));
      placed.push({ x, y });
      made++;
    }
  }

  // Zonas modificadoras (F2): estrada (acelera) + lamaçal (atrasa) + extra.
  const zones: Zone[] = [];
  const addZonePair = (speedMul: number, radius: number): void => {
    const zx = 300 + rand() * (W - 600);
    const zy = 250 + rand() * (H - 500);
    zones.push({ x: zx, y: zy, radius, speedMul });
    const zm = mirror(zx, zy);
    zones.push({ x: zm.x, y: zm.y, radius, speedMul });
  };
  addZonePair(MAP_MODS.roadSpeedMul, MAP_MODS.roadRadius);
  addZonePair(MAP_MODS.mudSpeedMul, MAP_MODS.mudRadius);
  if (rand() < 0.5) addZonePair(MAP_MODS.roadSpeedMul, MAP_MODS.roadRadius);
  else addZonePair(MAP_MODS.mudSpeedMul, MAP_MODS.mudRadius);
  // F5-lite: o mundo 4× pede mais textura — um 4º par no FFA.
  if (enemyCount > 1) {
    if (rand() < 0.5) addZonePair(MAP_MODS.roadSpeedMul, MAP_MODS.roadRadius);
    else addZonePair(MAP_MODS.mudSpeedMul, MAP_MODS.mudRadius);
  }

  return { nodes, rng, zones, layout };
}
