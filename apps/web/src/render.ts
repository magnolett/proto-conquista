import type { GameState, Node, Fleet } from '@conquista/sim';
import { visibleNodeIds, computeScore } from '@conquista/sim';
import type { Owner, Difficulty, BaseKind } from '@conquista/shared';
import { DIFFICULTY, BASE_KINDS, FOG, PERSONAS, CORE } from '@conquista/shared';

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

/** Última visão conhecida de um nó (F2.5 — memória sob névoa). Só apresentação. */
export interface GhostInfo {
  readonly owner: Owner;
  readonly kind: BaseKind;
  readonly tier: number;
  readonly troops: number;
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
  /** Caixa de seleção em coords de MUNDO (ou null). */
  readonly box: { x: number; y: number; w: number; h: number } | null;
  /** Fração de envio atual (0..1). */
  readonly sendRatio: number;
  /** Pausado? */
  readonly paused: boolean;
  /** Névoa de guerra ligada? (F2 — afeta só a visão do jogador, nunca a sim/IA.) */
  readonly fog?: boolean;
  /** Som desligado? (F3 — indicador no rodapé.) */
  readonly muted?: boolean;
  /** Tela de MENU ativa? (F3 — o jogo congelado fica ao fundo.) */
  readonly menu?: boolean;
  /** Dica de onboarding ativa (F3), ou null. */
  readonly tip?: string | null;
  /** Visibilidade já computada pelo main (evita recomputar aqui). */
  readonly visibleIds?: ReadonlySet<number> | null;
  /** Memória de última visão por nó (F2.5) — o que a névoa esconde vira lembrança. */
  readonly ghosts?: ReadonlyMap<number, GhostInfo>;
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

function drawNode(
  ctx: CanvasRenderingContext2D,
  v: View,
  n: Node,
  selected: boolean,
  hideCount = false,
  hideTier = false,
): void {
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
  ctx.fillText(hideCount ? '?' : String(Math.floor(n.troops)), p.x, p.y);
  if (!hideTier) {
    ctx.fillStyle = 'rgba(234,242,255,0.5)';
    ctx.font = '10px system-ui,Arial';
    ctx.fillText('T' + (n.tier + 1), p.x, p.y + r + 12);
  }
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
      '   ·   ⏱ ' +
      fmtTime(s.time) +
      (ui.paused ? '   — PAUSA' : ''),
    v.screenW / 2,
    16,
  );
  ctx.fillStyle = 'rgba(234,242,255,0.55)';
  ctx.font = '12px system-ui,Arial';
  ctx.fillText(
    'arraste = enviar (Shift no arrasto fixa DESVIO)  |  caixa+clique = multi-envio  |  [1-4] força  [U] upgrade  [Z/X/C] spec escudo/veloz/canhão  [Espaço] pausa  [R/Shift+R] seed  [G] dificuldade  [F] névoa  [M] som' +
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
  // Persona da IA (F2.5): revelada SÓ aqui — durante a partida o jogador precisa LER.
  ctx.fillStyle = 'rgba(234,242,255,0.75)';
  ctx.font = '15px system-ui,Arial';
  ctx.fillText(
    'Oponente: ' + PERSONAS[s.persona].label + ' · ' + DIFFICULTY[s.difficulty].label,
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
    '[G] Dificuldade: ' + DIFFICULTY[s.difficulty].label + '   ·   [R] outro mapa   ·   [M] som',
    cx,
    cy + 22,
  );
  ctx.fillStyle = 'rgba(234,242,255,0.6)';
  ctx.font = '13px system-ui,Arial';
  const lines = [
    'arraste de uma base sua = enviar tropas · caixa + clique = várias de uma vez',
    'Shift durante o arrasto fixa um DESVIO na rota · [1-4] força do envio',
    '[U] evoluir (obra vulnerável!) · [Z/X/C] evoluir como escudo / veloz / canhão',
    'vença ELIMINANDO a IA ou DOMINANDO a fortaleza central · [F] névoa · [O] diais',
  ];
  lines.forEach((ln, i) => ctx.fillText(ln, cx, cy + 62 + i * 22));
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

/** Fontes de visão do jogador (F2 — névoa): centro de cada base/frota sua. */
function visionSources(s: GameState): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (const n of s.nodes) if (n.owner === 'you') out.push({ x: n.x, y: n.y });
  for (const f of s.fleets) if (f.owner === 'you') out.push({ x: f.x, y: f.y });
  return out;
}

/** Overlay de névoa: escurece o mapa e "abre" círculos suaves de visão nas fontes. */
function drawFog(
  ctx: CanvasRenderingContext2D,
  v: View,
  sources: Array<{ x: number; y: number }>,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(4,7,16,0.6)';
  ctx.fillRect(0, 0, v.screenW, v.screenH);
  ctx.globalCompositeOperation = 'destination-out';
  const r = FOG.sightRadius * v.scale;
  for (const s of sources) {
    const p = toScreen(v, s.x, s.y);
    const g = ctx.createRadialGradient(p.x, p.y, r * 0.55, p.x, p.y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
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

  // Névoa de guerra (F2): computa a visibilidade do jogador (só apresentação).
  const fog = ui.fog ?? false;
  const sources = fog ? visionSources(s) : null;
  const visible = fog ? (ui.visibleIds ?? visibleNodeIds(s, FOG.sightRadius)) : null;
  const r2 = FOG.sightRadius * FOG.sightRadius;
  const seen = (x: number, y: number): boolean => {
    if (!sources) return true;
    for (const pt of sources) {
      const dx = x - pt.x;
      const dy = y - pt.y;
      if (dx * dx + dy * dy <= r2) return true;
    }
    return false;
  };

  for (const f of s.fleets) {
    if (fog && f.owner !== 'you' && !seen(f.x, f.y)) continue; // frota inimiga na névoa: oculta
    drawFleet(ctx, v, s, f);
  }
  if (ui.fx && ui.fx.length > 0) drawFx(ctx, v, ui.fx);
  for (const n of s.nodes) {
    const isVisible = !visible || n.owner === 'you' || visible.has(n.id);
    if (isVisible) {
      drawNode(ctx, v, n, ui.selection.has(n.id));
      continue;
    }
    // F2.5 — memória de última visão: fora da névoa desenha-se a LEMBRANÇA
    // (dono/tier/tropas de quando foi visto), esmaecida; nunca visto = '?' anônimo.
    const g = ui.ghosts?.get(n.id);
    ctx.globalAlpha = 0.45;
    if (g) {
      drawNode(
        ctx,
        v,
        {
          ...n,
          owner: g.owner,
          kind: g.kind,
          tier: g.tier,
          troops: g.troops,
          pulse: 0,
          underAttack: false,
          upgrading: undefined,
        },
        false,
      );
    } else {
      drawNode(
        ctx,
        v,
        { ...n, owner: 'neutral', kind: 'normal', troops: 0, pulse: 0, underAttack: false, upgrading: undefined },
        false,
        true,
        true,
      );
    }
    ctx.globalAlpha = 1;
  }
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
  if (fog && sources) drawFog(ctx, v, sources);
  drawHUD(ctx, v, s, ui);
  if (ui.tip) drawTip(ctx, v, ui.tip);
  if (ui.debug?.visible) drawDebugOverlay(ctx, s, ui.debug);
  if (s.gameOver) drawBanner(ctx, v, s);
  if (ui.menu) drawMenuOverlay(ctx, v, s);
}
