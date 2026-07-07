import type { GameState, Node, Fleet } from '@conquista/sim';
import { computeScore } from '@conquista/sim';
import type { Owner, Difficulty } from '@conquista/shared';
import { DIFFICULTY, BASE_KINDS, PERSONAS, CORE, DOCTRINES, DOCTRINE_ORDER } from '@conquista/shared';

/** Paleta tática (porte de COL do game.js) + rivais do FFA (F5-lite). */
export const COL = {
  bg: '#0a0e1a',
  grid: 'rgba(120,160,255,0.05)',
  you: '#39d8ff',
  enemy: '#ff7a4a',
  e2: '#c084fc',
  e3: '#a3e635',
  neutral: '#7a869c',
  text: '#eaf2ff',
} as const;

export function ownerColor(o: Owner): string {
  if (o === 'you') return COL.you;
  if (o === 'enemy') return COL.enemy;
  if (o === 'e2') return COL.e2;
  if (o === 'e3') return COL.e3;
  return COL.neutral;
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
  /** Ponto de passagem fixado com Shift durante o arrasto (F2.5), ou null. */
  readonly dragWaypoint?: { x: number; y: number } | null;
  /** Base de origem de um arrasto de ROTA (botão direito — F4-lite), ou null. */
  readonly routeDragFrom?: number | null;
  /** Caixa de seleção em coords de MUNDO (ou null). */
  readonly box: { x: number; y: number; w: number; h: number } | null;
  /** Fração de envio atual (0..1). */
  readonly sendRatio: number;
  /** Pausado? */
  readonly paused: boolean;
  /** Som desligado? (F3 — indicador no rodapé.) */
  readonly muted?: boolean;
  /** Tela de MENU ativa? (F3 — o jogo congelado fica ao fundo.) */
  readonly menu?: boolean;
  /** Dica de onboarding ativa (F3), ou null. */
  readonly tip?: string | null;
  /** Ecos de interceptação (F2.5) com idade em s — a UI acumula e esmaece. */
  readonly fx?: ReadonlyArray<{ readonly x: number; readonly y: number; readonly age: number }>;
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

/** Zonas modificadoras de mapa (F2): estrada (clara, acelera) · lamaçal (terroso, atrasa). */
function drawZones(ctx: CanvasRenderingContext2D, v: View, s: GameState): void {
  if (!s.zones) return;
  for (const z of s.zones) {
    const p = toScreen(v, z.x, z.y);
    const r = z.radius * v.scale;
    const road = z.speedMul >= 1;
    ctx.save();
    const grad = ctx.createRadialGradient(p.x, p.y, r * 0.2, p.x, p.y, r);
    grad.addColorStop(0, road ? 'rgba(120,200,255,0.16)' : 'rgba(150,110,60,0.22)');
    grad.addColorStop(1, road ? 'rgba(120,200,255,0)' : 'rgba(150,110,60,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = road ? 'rgba(120,200,255,0.28)' : 'rgba(150,110,60,0.34)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 7]);
    ctx.stroke();
    ctx.restore();
  }
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
      if (ui.dragWaypoint) {
        // rota com desvio (F2.5): origem → waypoint → cursor, com losango no ponto
        const w = toScreen(v, ui.dragWaypoint.x, ui.dragWaypoint.y);
        line(ctx, p.x, p.y, w.x, w.y);
        line(ctx, w.x, w.y, m.x, m.y);
        ctx.fillStyle = 'rgba(57,216,255,0.9)';
        ctx.beginPath();
        ctx.moveTo(w.x, w.y - 6);
        ctx.lineTo(w.x + 6, w.y);
        ctx.lineTo(w.x, w.y + 6);
        ctx.lineTo(w.x - 6, w.y);
        ctx.closePath();
        ctx.fill();
      } else {
        line(ctx, p.x, p.y, m.x, m.y);
      }
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
  const aim = f.waypoint ?? tn; // a seta aponta p/ o rumo REAL (waypoint primeiro — F2.5)
  const ang = Math.atan2(aim.y - f.y, aim.x - f.x);
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

/** Decoração visual por tipo de base (F2): forma/ícone — zero asset. */
function drawKindDecor(
  ctx: CanvasRenderingContext2D,
  v: View,
  n: Node,
  p: { x: number; y: number },
  r: number,
  c: string,
): void {
  if (n.kind === 'normal') return;
  ctx.save();
  if (n.kind === 'shield') {
    // anel hexagonal externo = mais resistente
    ctx.strokeStyle = c;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const px = p.x + Math.cos(a) * (r + 6);
      const py = p.y + Math.sin(a) * (r + 6);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  } else if (n.kind === 'fast') {
    // chevron duplo acima = mais rápido
    ctx.strokeStyle = c;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2.5;
    const top = p.y - r - 4;
    for (let k = 0; k < 2; k++) {
      const oy = top - k * 5;
      ctx.beginPath();
      ctx.moveTo(p.x - 6, oy + 4);
      ctx.lineTo(p.x, oy);
      ctx.lineTo(p.x + 6, oy + 4);
      ctx.stroke();
    }
  } else if (n.kind === 'cannon') {
    // alcance tênue + 4 "canos" radiais
    const range = BASE_KINDS[n.kind].cannonRange * v.scale;
    ctx.strokeStyle = c;
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      ctx.lineTo(p.x + Math.cos(a) * (r + 7), p.y + Math.sin(a) * (r + 7));
      ctx.stroke();
    }
  }
  ctx.restore();
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
  drawKindDecor(ctx, v, n, p, r, c);
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
  if (n.upgrading) {
    // Obra em andamento (F2.5): arco de progresso âmbar + kind alvo — a base está vulnerável.
    const prog = Math.max(0, Math.min(1, 1 - n.upgrading.remaining / n.upgrading.total));
    ctx.save();
    ctx.strokeStyle = 'rgba(255,200,80,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,80,0.95)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 4, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,200,80,0.9)';
    ctx.font = '10px system-ui,Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⚒ ' + BASE_KINDS[n.upgrading.kind].label, p.x, p.y - r - 16);
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

/** Anel + contagem do DOMÍNIO do centro (F2.5): quem segura a fortaleza e quanto falta. */
function drawCoreHold(ctx: CanvasRenderingContext2D, v: View, s: GameState): void {
  if (CORE.holdSeconds <= 0 || !s.coreHold.owner) return;
  const core = s.nodes.find((n) => n.isCore);
  if (!core) return;
  const p = toScreen(v, core.x, core.y);
  const r = (core.radius + 12) * v.scale;
  const frac = Math.min(1, s.coreHold.held / CORE.holdSeconds);
  const c = ownerColor(s.coreHold.owner);
  const left = Math.max(0, Math.ceil(CORE.holdSeconds - s.coreHold.held));
  ctx.save();
  ctx.strokeStyle = c;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = c;
  ctx.font = 'bold 11px system-ui,Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('⚑ ' + left + 's', p.x, p.y + r + 6);
  if (frac >= 0.5) {
    // alarme: metade do caminho p/ a vitória por domínio
    ctx.font = 'bold 15px system-ui,Arial';
    ctx.fillText(
      s.coreHold.owner === 'you'
        ? '⚑ Você domina o centro — vitória em ' + left + 's'
        : '⚑ A IA domina o centro — reaja em ' + left + 's',
      v.screenW / 2,
      40,
    );
  }
  ctx.restore();
}

/** Formata segundos em m:ss (cronômetro da partida — F2). */
function fmtTime(t: number): string {
  const total = Math.max(0, Math.floor(t));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return m + ':' + String(sec).padStart(2, '0');
}

function drawHUD(ctx: CanvasRenderingContext2D, v: View, s: GameState, ui: UiState): void {
  const you = s.nodes.filter((n) => n.owner === 'you');
  const yt = Math.round(you.reduce((a, n) => a + n.troops, 0));
  const diff: Difficulty = s.difficulty;
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = 'bold 16px system-ui,Arial';
  ctx.fillStyle = COL.you;
  ctx.fillText('VOCÊ  ' + you.length + ' bases · ' + yt + ' tropas', 16, 14);
  // FFA (F5-lite): um placar compacto POR RIVAL, empilhado à direita, na cor dele.
  const rivalIds: Owner[] = ['enemy', 'e2', 'e3'];
  let row = 0;
  ctx.textAlign = 'right';
  ctx.font = 'bold 14px system-ui,Arial';
  for (const id of rivalIds) {
    if (id !== 'enemy' && !s.rivals?.some((r) => r.id === id)) continue;
    const ns = s.nodes.filter((n) => n.owner === id);
    const t = Math.round(ns.reduce((a, n) => a + n.troops, 0));
    ctx.fillStyle = ownerColor(id);
    const label = ns.length === 0 ? '☠ eliminada' : ns.length + 'b · ' + t + 't';
    ctx.fillText('IA' + (row + 1) + '  ' + label, v.screenW - 16, 14 + row * 20);
    row++;
  }
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
      '   ·   ⏱ ' +
      fmtTime(s.time) +
      (ui.paused ? '   — PAUSA' : ''),
    v.screenW / 2,
    16,
  );
  ctx.fillStyle = 'rgba(234,242,255,0.55)';
  ctx.font = '12px system-ui,Arial';
  ctx.fillText(
    'arraste = enviar (Shift fixa DESVIO)  |  DIREITO arrastado = ROTA  |  scroll = zoom · botão do MEIO = câmera  |  [1-4] força  [U/Z/X/C] evoluir  [Q] doutrina  [Espaço] pausa  [R/Shift+R] seed  [G] dificuldade  [M] som' +
      (ui.muted ? ' OFF' : '') +
      '  [O] debug',
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
  const cx = v.screenW / 2;
  const cy = v.screenH / 2;
  ctx.fillStyle = s.winner === 'you' ? COL.you : COL.enemy;
  ctx.font = 'bold 54px system-ui,Arial';
  ctx.fillText(s.winner === 'you' ? 'VITÓRIA' : 'DERROTA', cx, cy - 48);
  if (s.winReason === 'core') {
    ctx.fillStyle = 'rgba(234,242,255,0.8)';
    ctx.font = '15px system-ui,Arial';
    ctx.fillText('pelo domínio do centro', cx, cy - 16);
  }
  // Placar (F2): tempo da partida + pontuação dos dois lados.
  const ys = computeScore(s, 'you');
  const es = computeScore(s, 'enemy');
  ctx.fillStyle = COL.text;
  ctx.font = 'bold 22px system-ui,Arial';
  ctx.fillText('Tempo ' + fmtTime(s.time), cx, cy + 4);
  ctx.font = '20px system-ui,Arial';
  ctx.fillStyle = COL.you;
  ctx.fillText('Você ' + ys, cx - 70, cy + 38);
  ctx.fillStyle = COL.text;
  ctx.fillText('×', cx, cy + 38);
  ctx.fillStyle = COL.enemy;
  ctx.fillText(es + ' IA', cx + 70, cy + 38);
  // Personas das IAs (F2.5): reveladas SÓ aqui — durante a partida o jogador LÊ.
  ctx.fillStyle = 'rgba(234,242,255,0.75)';
  ctx.font = '15px system-ui,Arial';
  const personas = [PERSONAS[s.persona].label, ...(s.rivals ?? []).map((r) => PERSONAS[r.persona].label)];
  ctx.fillText(
    (personas.length > 1 ? 'Oponentes: ' : 'Oponente: ') +
      personas.join(', ') +
      ' · ' +
      DIFFICULTY[s.difficulty].label,
    cx,
    cy + 68,
  );
  ctx.fillStyle = COL.text;
  ctx.font = '16px system-ui,Arial';
  ctx.fillText('pressione R para uma nova partida', cx, cy + 98);
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
    'dificuldade ' + s.difficulty + ' · persona ' + s.persona + ' · seed ' + s.seed,
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

/** Geometria do MINIMAPA (F5-lite) — exportada p/ o hit-test de clique no main. */
export function minimapRect(v: View): { x: number; y: number; w: number; h: number } {
  const w = 216;
  const h = Math.round((w * 9) / 16); // mundo 16:9
  return { x: v.screenW - w - 14, y: v.screenH - h - 44, w, h };
}

/** Minimapa (F5-lite): nós como pontos coloridos + retângulo da viewport. */
function drawMinimap(ctx: CanvasRenderingContext2D, v: View, s: GameState): void {
  const mm = minimapRect(v);
  const W = s.config.worldW;
  const H = s.config.worldH;
  ctx.save();
  ctx.fillStyle = 'rgba(5,10,22,0.85)';
  ctx.strokeStyle = 'rgba(120,160,255,0.35)';
  ctx.lineWidth = 1;
  ctx.fillRect(mm.x, mm.y, mm.w, mm.h);
  ctx.strokeRect(mm.x, mm.y, mm.w, mm.h);
  for (const n of s.nodes) {
    ctx.fillStyle = ownerColor(n.owner);
    const px = mm.x + (n.x / W) * mm.w;
    const py = mm.y + (n.y / H) * mm.h;
    const r = n.isCore ? 3.5 : 2 + n.tier * 0.7;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // retângulo da viewport atual (o que a câmera vê)
  const vx = (-v.offsetX / v.scale / W) * mm.w + mm.x;
  const vy = (-v.offsetY / v.scale / H) * mm.h + mm.y;
  const vw = (v.screenW / v.scale / W) * mm.w;
  const vh = (v.screenH / v.scale / H) * mm.h;
  ctx.strokeStyle = 'rgba(234,242,255,0.7)';
  ctx.strokeRect(
    Math.max(mm.x, vx),
    Math.max(mm.y, vy),
    Math.min(vw, mm.w),
    Math.min(vh, mm.h),
  );
  ctx.restore();
}

/** Rotas de suprimento ativas (F4-lite): tracejado animado origem→destino. */
function drawRoutes(ctx: CanvasRenderingContext2D, v: View, s: GameState, ui: UiState): void {
  ctx.save();
  ctx.setLineDash([3, 9]);
  ctx.lineWidth = 2;
  ctx.lineDashOffset = -((s.time * 40) % 12);
  for (const n of s.nodes) {
    if (n.routeTo === undefined) continue;
    const to = s.nodes[n.routeTo];
    if (!to) continue;
    const a = toScreen(v, n.x, n.y);
    const b = toScreen(v, to.x, to.y);
    ctx.strokeStyle = n.owner === 'you' ? 'rgba(57,216,255,0.45)' : 'rgba(255,122,74,0.45)';
    line(ctx, a.x, a.y, b.x, b.y);
  }
  // arrasto de rota em curso (botão direito): guia âmbar até o cursor
  if (ui.routeDragFrom !== null && ui.routeDragFrom !== undefined) {
    const n = s.nodes[ui.routeDragFrom];
    if (n) {
      const a = toScreen(v, n.x, n.y);
      const m = toScreen(v, ui.mouseWorld.x, ui.mouseWorld.y);
      ctx.strokeStyle = 'rgba(255,200,80,0.8)';
      line(ctx, a.x, a.y, m.x, m.y);
    }
  }
  ctx.restore();
}

/** HUD da doutrina (F4-lite): a sua no canto; a da IA só quando ATIVA (alarme). */
function drawDoctrineHUD(ctx: CanvasRenderingContext2D, v: View, s: GameState): void {
  const d = s.doctrines.you;
  const cfg = DOCTRINES[d.id];
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.font = 'bold 14px system-ui,Arial';
  const y = v.screenH - 44;
  let status: string;
  if (d.activeLeft > 0) status = 'ATIVA ' + Math.ceil(d.activeLeft) + 's';
  else if (d.cooldownLeft > 0) status = 'recarrega ' + Math.ceil(d.cooldownLeft) + 's';
  else status = 'pronta — [Q]';
  ctx.fillStyle = d.activeLeft > 0 ? COL.you : d.cooldownLeft > 0 ? 'rgba(234,242,255,0.45)' : COL.text;
  ctx.fillText('⚡ ' + cfg.label + ' · ' + status, 16, y);
  // Alarmes de doutrina RIVAL ativa (FFA: cada IA na própria cor, empilhadas).
  const rivalDoctrines: Array<{ owner: Owner; st: { id: import('@conquista/shared').DoctrineId; activeLeft: number } }> = [
    { owner: 'enemy', st: s.doctrines.enemy },
    ...(s.rivals ?? []).map((r) => ({ owner: r.id as Owner, st: r.doctrine })),
  ];
  let alarmRow = 0;
  ctx.textAlign = 'center';
  for (const { owner, st } of rivalDoctrines) {
    if (st.activeLeft <= 0) continue;
    ctx.fillStyle = ownerColor(owner);
    ctx.fillText('⚡ rival ativou ' + DOCTRINES[st.id].label + '!', v.screenW / 2, 64 + alarmRow * 20);
    alarmRow++;
  }
  ctx.restore();
}

/** Dica de onboarding (F3): caixa discreta acima do rodapé. */
function drawTip(ctx: CanvasRenderingContext2D, v: View, text: string): void {
  ctx.save();
  ctx.font = '14px system-ui,Segoe UI,Arial';
  const w = ctx.measureText(text).width + 36;
  const h = 34;
  const x = (v.screenW - w) / 2;
  const y = v.screenH - 78;
  ctx.fillStyle = 'rgba(5,10,22,0.88)';
  ctx.strokeStyle = 'rgba(57,216,255,0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COL.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💡 ' + text, v.screenW / 2, y + h / 2);
  ctx.restore();
}

/** Tela de MENU (F3): véu sobre o mapa congelado + painel central. Zero asset. */
function drawMenuOverlay(ctx: CanvasRenderingContext2D, v: View, s: GameState): void {
  ctx.save();
  ctx.fillStyle = 'rgba(4,7,16,0.72)';
  ctx.fillRect(0, 0, v.screenW, v.screenH);
  const cx = v.screenW / 2;
  const cy = v.screenH / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = COL.you;
  ctx.shadowBlur = 26;
  ctx.fillStyle = COL.you;
  ctx.font = 'bold 64px system-ui,Segoe UI,Arial';
  ctx.fillText('CONQUISTA', cx, cy - 118);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(234,242,255,0.85)';
  ctx.font = '17px system-ui,Arial';
  ctx.fillText('domine o mapa — decisão vence reflexo', cx, cy - 72);
  ctx.fillStyle = COL.text;
  ctx.font = 'bold 22px system-ui,Arial';
  ctx.fillText('CLIQUE (ou Espaço) para começar', cx, cy - 18);
  ctx.fillStyle = 'rgba(234,242,255,0.8)';
  ctx.font = '15px system-ui,Arial';
  ctx.fillText(
    '[G] Dificuldade: ' +
      DIFFICULTY[s.difficulty].label +
      '   ·   [E] Oponentes: ' +
      (1 + (s.rivals?.length ?? 0)) +
      '   ·   [R] outro mapa   ·   [M] som',
    cx,
    cy + 22,
  );
  // Doutrina escolhida (F4-lite): [1/2/3] seleciona; a atual em destaque.
  const dSel = s.doctrines.you.id;
  ctx.font = '14px system-ui,Arial';
  const dLine = DOCTRINE_ORDER.map(
    (id, i) => `[${i + 1}] ${DOCTRINES[id].label}${id === dSel ? ' ✓' : ''}`,
  ).join('   ·   ');
  ctx.fillStyle = COL.you;
  ctx.fillText('Doutrina: ' + dLine, cx, cy + 48);
  ctx.fillStyle = 'rgba(234,242,255,0.65)';
  ctx.font = '12px system-ui,Arial';
  ctx.fillText('(' + DOCTRINES[dSel].hint + ' — ative com [Q] durante a partida)', cx, cy + 68);
  ctx.fillStyle = 'rgba(234,242,255,0.6)';
  ctx.font = '13px system-ui,Arial';
  const lines = [
    'arraste de uma base sua = enviar tropas · caixa + clique = várias de uma vez',
    'Shift durante o arrasto fixa um DESVIO · botão DIREITO arrastado = ROTA de suprimento',
    '[U] evoluir (obra vulnerável!) · [Z/X/C] evoluir como escudo / veloz / canhão',
    'SCROLL dá zoom · botão do MEIO arrasta a câmera · clique no minimapa teleporta',
    'vença ELIMINANDO todos os rivais ou DOMINANDO a fortaleza central · [O] diais',
  ];
  lines.forEach((ln, i) => ctx.fillText(ln, cx, cy + 100 + i * 22));
  ctx.restore();
}

/** Flash de interceptação (F2.5): anel âmbar que expande e esmaece no ponto da briga. */
function drawFx(
  ctx: CanvasRenderingContext2D,
  v: View,
  fx: NonNullable<UiState['fx']>,
): void {
  ctx.save();
  for (const e of fx) {
    const t = Math.min(1, e.age / 0.45);
    const p = toScreen(v, e.x, e.y);
    ctx.strokeStyle = `rgba(255,214,120,${(1 - t) * 0.9})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (4 + t * 20) * v.scale, 0, Math.PI * 2);
    ctx.stroke();
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
  drawZones(ctx, v, s);
  drawGuides(ctx, v, s, ui);

  drawRoutes(ctx, v, s, ui);
  for (const f of s.fleets) drawFleet(ctx, v, s, f);
  if (ui.fx && ui.fx.length > 0) drawFx(ctx, v, ui.fx);
  for (const n of s.nodes) drawNode(ctx, v, n, ui.selection.has(n.id));
  drawCoreHold(ctx, v, s);
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
  drawDoctrineHUD(ctx, v, s);
  drawMinimap(ctx, v, s);
  if (ui.tip) drawTip(ctx, v, ui.tip);
  if (ui.debug?.visible) drawDebugOverlay(ctx, s, ui.debug);
  if (s.gameOver) drawBanner(ctx, v, s);
  if (ui.menu) drawMenuOverlay(ctx, v, s);
}
