import type { GameState, Node, Fleet } from '@conquista/sim';
import type { Owner, Difficulty } from '@conquista/shared';
import { DIFFICULTY } from '@conquista/shared';

/** Paleta tática (porte de COL do game.js). */
export const COL = {
  bg: '#0a0e1a',
  grid: 'rgba(120,160,255,0.05)',
  you: '#39d8ff',
  enemy: '#ff7a4a',
  neutral: '#7a869c',
  text: '#eaf2ff',
} as const;

export function ownerColor(o: Owner): string {
  return o === 'you' ? COL.you : o === 'enemy' ? COL.enemy : COL.neutral;
}

/** Mapeamento mundo→tela (fit com letterbox). */
export interface View {
  scale: number;
  offsetX: number;
  offsetY: number;
  /** dimensões da tela (px). */
  screenW: number;
  screenH: number;
}

/** Calcula o view que encaixa o mundo (worldW x worldH) na tela, centralizado. */
export function computeView(
  worldW: number,
  worldH: number,
  screenW: number,
  screenH: number,
): View {
  const scale = Math.min(screenW / worldW, screenH / worldH);
  const offsetX = (screenW - worldW * scale) / 2;
  const offsetY = (screenH - worldH * scale) / 2;
  return { scale, offsetX, offsetY, screenW, screenH };
}

/** Mundo→tela. */
export function toScreen(v: View, x: number, y: number): { x: number; y: number } {
  return { x: v.offsetX + x * v.scale, y: v.offsetY + y * v.scale };
}

/** Tela→mundo (p/ converter o mouse). */
export function toWorld(v: View, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - v.offsetX) / v.scale, y: (sy - v.offsetY) / v.scale };
}

/** Estado de UI que a render precisa, mas que NÃO pertence à sim. */
export interface UiState {
  /** Ids selecionados pelo jogador. */
  readonly selection: ReadonlySet<number>;
  /** Posição do mouse em coords de MUNDO. */
  readonly mouseWorld: { x: number; y: number };
  /** Base origem de um arraste em curso (ou null). */
  readonly dragSourceId: number | null;
  /** Caixa de seleção em coords de MUNDO (ou null). */
  readonly box: { x: number; y: number; w: number; h: number } | null;
  /** Fração de envio atual (0..1). */
  readonly sendRatio: number;
  /** Pausado? */
  readonly paused: boolean;
  /** Dados do overlay de debug (undefined = oculto). */
  readonly debug?: DebugOverlayData;
}

/** Dados que o overlay de debug precisa (FPS e diais vêm da UI; métricas saem do state). */
export interface DebugOverlayData {
  readonly visible: boolean;
  readonly fps: number;
  readonly dials: ReadonlyArray<{ readonly name: string; readonly value: number }>;
  readonly dialIndex: number;
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawGrid(ctx: CanvasRenderingContext2D, v: View): void {
  ctx.strokeStyle = COL.grid;
  ctx.lineWidth = 1;
  const g = 60 * v.scale;
  ctx.beginPath();
  for (let x = v.offsetX % g; x < v.screenW; x += g) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, v.screenH);
  }
  for (let y = v.offsetY % g; y < v.screenH; y += g) {
    ctx.moveTo(0, y);
    ctx.lineTo(v.screenW, y);
  }
  ctx.stroke();
}

function drawGuides(ctx: CanvasRenderingContext2D, v: View, s: GameState, ui: UiState): void {
  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 1.5;
  const m = toScreen(v, ui.mouseWorld.x, ui.mouseWorld.y);
  if (ui.dragSourceId !== null) {
    const n = s.nodes[ui.dragSourceId];
    if (n) {
      ctx.strokeStyle = 'rgba(57,216,255,0.75)';
      const p = toScreen(v, n.x, n.y);
      line(ctx, p.x, p.y, m.x, m.y);
    }
  } else if (ui.selection.size > 0) {
    ctx.strokeStyle = 'rgba(57,216,255,0.4)';
    for (const id of ui.selection) {
      const n = s.nodes[id];
      if (!n) continue;
      const p = toScreen(v, n.x, n.y);
      line(ctx, p.x, p.y, m.x, m.y);
    }
  }
  ctx.restore();
}

function drawFleet(ctx: CanvasRenderingContext2D, v: View, s: GameState, f: Fleet): void {
  const tn = s.nodes[f.target];
  if (!tn) return;
  const ang = Math.atan2(tn.y - f.y, tn.x - f.x);
  const c = ownerColor(f.owner);
  const size = (3 + Math.sqrt(f.count)) * v.scale;
  const p = toScreen(v, f.x, f.y);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(ang);
  ctx.shadowColor = c;
  ctx.shadowBlur = 10;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(size * 1.6, 0);
  ctx.lineTo(-size, size * 0.8);
  ctx.lineTo(-size, -size * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (f.count >= 10) {
    ctx.fillStyle = c;
    ctx.font = '10px system-ui,Arial';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.floor(f.count)), p.x, p.y - 11);
  }
}

function drawNode(ctx: CanvasRenderingContext2D, v: View, n: Node, selected: boolean): void {
  const c = ownerColor(n.owner);
  const p = toScreen(v, n.x, n.y);
  const r = n.radius * v.scale;
  ctx.save();
  ctx.shadowColor = c;
  ctx.shadowBlur = 16 + n.pulse * 30;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10,16,30,0.92)';
  ctx.fill();
  ctx.lineWidth = 3 + n.tier;
  ctx.strokeStyle = c;
  ctx.stroke();
  ctx.restore();
  if (n.underAttack) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,90,70,0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (selected) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = COL.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold ' + Math.max(12, Math.floor(r * 0.8)) + 'px system-ui,Segoe UI,Arial';
  ctx.fillText(String(Math.floor(n.troops)), p.x, p.y);
  ctx.fillStyle = 'rgba(234,242,255,0.5)';
  ctx.font = '10px system-ui,Arial';
  ctx.fillText('T' + (n.tier + 1), p.x, p.y + r + 12);
}

function drawHUD(ctx: CanvasRenderingContext2D, v: View, s: GameState, ui: UiState): void {
  const you = s.nodes.filter((n) => n.owner === 'you');
  const en = s.nodes.filter((n) => n.owner === 'enemy');
  const yt = Math.round(you.reduce((a, n) => a + n.troops, 0));
  const et = Math.round(en.reduce((a, n) => a + n.troops, 0));
  const diff: Difficulty = s.difficulty;
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = 'bold 16px system-ui,Arial';
  ctx.fillStyle = COL.you;
  ctx.fillText('VOCÊ  ' + you.length + ' bases · ' + yt + ' tropas', 16, 14);
  ctx.textAlign = 'right';
  ctx.fillStyle = COL.enemy;
  ctx.fillText(en.length + ' bases · ' + et + ' tropas  IA', v.screenW - 16, 14);
  ctx.textAlign = 'center';
  ctx.fillStyle = COL.text;
  ctx.font = '14px system-ui,Arial';
  ctx.fillText(
    'Força de envio: ' +
      Math.round(ui.sendRatio * 100) +
      '%   ·   Dificuldade: ' +
      DIFFICULTY[diff].label +
      '   ·   Seed: ' +
      s.seed +
      (ui.paused ? '   — PAUSA' : ''),
    v.screenW / 2,
    16,
  );
  ctx.fillStyle = 'rgba(234,242,255,0.55)';
  ctx.font = '12px system-ui,Arial';
  ctx.fillText(
    'arraste base sua → enviar  |  caixa + clique = multi-envio  |  [1-4] força  [U] upgrade  [Espaço] pausa  [R] nova seed  [Shift+R] mesma seed  [G] dificuldade  [O] debug',
    v.screenW / 2,
    v.screenH - 22,
  );
  ctx.restore();
}

function drawBanner(ctx: CanvasRenderingContext2D, v: View, s: GameState): void {
  ctx.save();
  ctx.fillStyle = 'rgba(5,8,16,0.72)';
  ctx.fillRect(0, 0, v.screenW, v.screenH);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = s.winner === 'you' ? COL.you : COL.enemy;
  ctx.font = 'bold 54px system-ui,Arial';
  ctx.fillText(s.winner === 'you' ? 'VITÓRIA' : 'DERROTA', v.screenW / 2, v.screenH / 2 - 20);
  ctx.fillStyle = COL.text;
  ctx.font = '18px system-ui,Arial';
  ctx.fillText('pressione R para uma nova partida', v.screenW / 2, v.screenH / 2 + 30);
  ctx.restore();
}

/** Overlay de debug/playtest: FPS, métricas por lado (renda/s), dificuldade, seed e diais. */
function drawDebugOverlay(ctx: CanvasRenderingContext2D, s: GameState, d: DebugOverlayData): void {
  const side = (owner: Owner) => {
    const ns = s.nodes.filter((n) => n.owner === owner);
    const troops = Math.round(ns.reduce((a, n) => a + n.troops, 0));
    const income = ns.reduce((a, n) => a + (n.troops < n.cap ? n.prod : 0), 0);
    const fleets = s.fleets.filter((f) => f.owner === owner).length;
    return { bases: ns.length, troops, income, fleets };
  };
  const you = side('you');
  const en = side('enemy');
  const head: string[] = [
    'FPS ' + d.fps.toFixed(0),
    'VOCÊ  ' + you.bases + 'b  ' + you.troops + 't  +' + you.income.toFixed(1) + '/s  ' + you.fleets + 'fr',
    'IA    ' + en.bases + 'b  ' + en.troops + 't  +' + en.income.toFixed(1) + '/s  ' + en.fleets + 'fr',
    'dificuldade ' + s.difficulty + '   ·   seed ' + s.seed,
    '— diais ([Tab] sel · [-]/[=] ajusta) —',
  ];
  const lineH = 16;
  const pad = 8;
  const x = 16;
  const y = 44;
  const w = 256;
  const h = pad * 2 + (head.length + d.dials.length) * lineH;
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = '12px ui-monospace,Consolas,monospace';
  ctx.fillStyle = 'rgba(5,10,22,0.82)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(120,160,255,0.25)';
  ctx.strokeRect(x, y, w, h);
  let row = 0;
  for (const ln of head) {
    ctx.fillStyle = 'rgba(234,242,255,0.82)';
    ctx.fillText(ln, x + pad, y + pad + row * lineH);
    row++;
  }
  for (let i = 0; i < d.dials.length; i++) {
    const dl = d.dials[i]!;
    const sel = i === d.dialIndex;
    ctx.fillStyle = sel ? COL.you : 'rgba(234,242,255,0.7)';
    ctx.fillText((sel ? '> ' : '  ') + dl.name + ' = ' + dl.value, x + pad, y + pad + row * lineH);
    row++;
  }
  ctx.restore();
}

/** Desenha um frame completo a partir do GameState + UI. A render NÃO decide regra. */
export function render(
  ctx: CanvasRenderingContext2D,
  v: View,
  s: GameState,
  ui: UiState,
): void {
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0, 0, v.screenW, v.screenH);
  drawGrid(ctx, v);
  drawGuides(ctx, v, s, ui);
  for (const f of s.fleets) drawFleet(ctx, v, s, f);
  for (const n of s.nodes) drawNode(ctx, v, n, ui.selection.has(n.id));
  if (ui.box && (ui.box.w > 2 || ui.box.h > 2)) {
    const p = toScreen(v, ui.box.x, ui.box.y);
    const w = ui.box.w * v.scale;
    const h = ui.box.h * v.scale;
    ctx.save();
    ctx.fillStyle = 'rgba(120,200,255,0.08)';
    ctx.strokeStyle = 'rgba(120,200,255,0.5)';
    ctx.fillRect(p.x, p.y, w, h);
    ctx.strokeRect(p.x, p.y, w, h);
    ctx.restore();
  }
  drawHUD(ctx, v, s, ui);
  if (ui.debug?.visible) drawDebugOverlay(ctx, s, ui.debug);
  if (s.gameOver) drawBanner(ctx, v, s);
}
