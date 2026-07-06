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

  // Filtro geométrico do layout: aceita/rejeita posições candidatas de neutras.
  const distToSpine = (x: number, y: number): number => {
    // distância do ponto à reta capital→capital (o "corredor" da partida)
    const dx = mb.x - bx;
    const dy = mb.y - by;
    const len = hyp(dx, dy) || 1;
    return Math.abs((x - bx) * (dy / len) - (y - by) * (dx / len));
  };
  const fitsLayout = (x: number, y: number): boolean => {
    if (layout === 'lanes') return distToSpine(x, y) < 170;
    if (layout === 'flanks') return Math.abs(y - cy) > 130 || distToSpine(x, y) < 60;
    return true; // classic: espalhado
  };

  // Pares de bases neutras espelhadas (F4-lite: mais pares = mais frentes).
  let made = 0;
  let tries = 0;
  while (made < MAPGEN.neutralPairs && tries < 1200) {
    tries++;
    const x = 140 + rand() * (W - 280);
    const y = 120 + rand() * (H - 240);
    if (((x - cx) + (y - cy)) > -40) continue; // manter no lado do jogador p/ espelhar
    if (!fitsLayout(x, y)) continue;
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

  // Zonas modificadoras (F2): pares espelhados — estrada (acelera) + lamaçal
  // (atrasa) + um TERCEIRO par sorteado (F4-lite: mapas maiores pedem mais textura).
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
  if (rand() < 0.5) addZonePair(MAP_MODS.roadSpeedMul, MAP_MODS.roadRadius);
  else addZonePair(MAP_MODS.mudSpeedMul, MAP_MODS.mudRadius);

  return { nodes, rng, zones, layout };
}
