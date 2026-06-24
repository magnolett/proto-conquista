import {
  createInitialState,
  step,
  type GameState,
  type Inputs,
  type SendOrder,
  type UpgradeOrder,
} from '@conquista/sim';
import { CFG, TIERS, BASE_KINDS, DIFFICULTY_ORDER, type Difficulty } from '@conquista/shared';
import { computeView, toWorld, render, type View, type UiState } from './render.js';

// ===== Canvas =====
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let view: View = computeView(CFG.worldW, CFG.worldH, 1, 1);

function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  view = computeView(CFG.worldW, CFG.worldH, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

// ===== Estado de UI (NÃO é a sim) =====
let difficulty: Difficulty = 'normal';
let seed = (Math.random() * 0xffffffff) >>> 0; // só na inicialização; a sim não usa Math.random
let state: GameState = createInitialState(seed, { difficulty });

let selection = new Set<number>();
let sendRatio = CFG.sendDefault;
let paused = false;
let fog = false;
const mouseWorld = { x: 0, y: 0 };
let dragSourceId: number | null = null;
let box: { x: number; y: number; w: number; h: number } | null = null;
let boxStart: { x: number; y: number } | null = null;
let downPos: { x: number; y: number } | null = null;

// Fila de ordens do jogador a despachar no próximo step (a sim é a verdade).
let pendingSends: SendOrder[] = [];
let pendingUpgrades: UpgradeOrder[] = [];

// ===== Overlay de debug (tecla O) + edição de diais (Tab / - / =) =====
let debugVisible = false;
const fpsBuf = new Array<number>(60).fill(60);
let fpsPos = 0;
function recordFrame(dt: number): void {
  if (dt > 0) {
    fpsBuf[fpsPos] = 1 / dt;
    fpsPos = (fpsPos + 1) % fpsBuf.length;
  }
}
function avgFps(): number {
  let s = 0;
  for (const v of fpsBuf) s += v;
  return s / fpsBuf.length;
}

// Diais ajustáveis em runtime: mutam CFG/TIERS (os "diais" de balanceamento).
// fleetSpeed é lido ao vivo pela sim; prod/cap valem nas próximas aplicações de tier.
interface Dial {
  readonly name: string;
  get(): number;
  set(v: number): void;
  readonly step: number;
}
const DIALS: readonly Dial[] = [
  { name: 'fleetSpeed', get: () => CFG.fleetSpeed, set: (v) => { CFG.fleetSpeed = Math.max(20, v); }, step: 5 },
  { name: 'T1 prod', get: () => TIERS[0]!.prod, set: (v) => { TIERS[0]!.prod = Math.max(0, +v.toFixed(2)); }, step: 0.1 },
  { name: 'T1 cap', get: () => TIERS[0]!.cap, set: (v) => { TIERS[0]!.cap = Math.max(1, Math.round(v)); }, step: 2 },
  { name: 'T2 prod', get: () => TIERS[1]!.prod, set: (v) => { TIERS[1]!.prod = Math.max(0, +v.toFixed(2)); }, step: 0.1 },
  { name: 'T2 cap', get: () => TIERS[1]!.cap, set: (v) => { TIERS[1]!.cap = Math.max(1, Math.round(v)); }, step: 2 },
  { name: 'T3 prod', get: () => TIERS[2]!.prod, set: (v) => { TIERS[2]!.prod = Math.max(0, +v.toFixed(2)); }, step: 0.1 },
  { name: 'T3 cap', get: () => TIERS[2]!.cap, set: (v) => { TIERS[2]!.cap = Math.max(1, Math.round(v)); }, step: 2 },
  { name: 'escudo dmg', get: () => BASE_KINDS.shield.dmgTakenMul, set: (v) => { BASE_KINDS.shield.dmgTakenMul = Math.max(0.1, +v.toFixed(2)); }, step: 0.05 },
  { name: 'veloz mult', get: () => BASE_KINDS.fast.fleetSpeedMul, set: (v) => { BASE_KINDS.fast.fleetSpeedMul = Math.max(1, +v.toFixed(2)); }, step: 0.1 },
  { name: 'canhão alc', get: () => BASE_KINDS.cannon.cannonRange, set: (v) => { BASE_KINDS.cannon.cannonRange = Math.max(0, Math.round(v)); }, step: 10 },
  { name: 'canhão dps', get: () => BASE_KINDS.cannon.cannonDps, set: (v) => { BASE_KINDS.cannon.cannonDps = Math.max(0, +v.toFixed(1)); }, step: 1 },
];
let dialIndex = 0;

function newMatch(newSeed: number): void {
  seed = newSeed >>> 0;
  state = createInitialState(seed, { difficulty });
  selection = new Set();
  sendRatio = CFG.sendDefault;
  paused = false;
  dragSourceId = null;
  box = null;
  boxStart = null;
  downPos = null;
  pendingSends = [];
  pendingUpgrades = [];
}

// ===== Input → coords de mundo =====
function pos(e: MouseEvent): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  return toWorld(view, e.clientX - r.left, e.clientY - r.top);
}
function nodeAt(p: { x: number; y: number }) {
  for (const n of state.nodes) {
    if (Math.hypot(n.x - p.x, n.y - p.y) <= n.radius + 4) return n;
  }
  return null;
}

canvas.addEventListener('mousedown', (e) => {
  if (state.gameOver) return;
  const p = pos(e);
  downPos = p;
  mouseWorld.x = p.x;
  mouseWorld.y = p.y;
  const n = nodeAt(p);
  if (n && n.owner === 'you') {
    dragSourceId = n.id;
    box = null;
    boxStart = null;
  } else {
    boxStart = p;
    box = { x: p.x, y: p.y, w: 0, h: 0 };
    dragSourceId = null;
  }
});
canvas.addEventListener('mousemove', (e) => {
  const p = pos(e);
  mouseWorld.x = p.x;
  mouseWorld.y = p.y;
  if (box && boxStart) {
    box.x = Math.min(boxStart.x, p.x);
    box.y = Math.min(boxStart.y, p.y);
    box.w = Math.abs(p.x - boxStart.x);
    box.h = Math.abs(p.y - boxStart.y);
  }
});
canvas.addEventListener('mouseup', (e) => {
  if (state.gameOver) {
    dragSourceId = null;
    box = null;
    boxStart = null;
    return;
  }
  const p = pos(e);
  const moved = downPos !== null && Math.hypot(p.x - downPos.x, p.y - downPos.y) > 6;
  const up = nodeAt(p);
  if (dragSourceId !== null) {
    if (moved && up && up.id !== dragSourceId) {
      pendingSends.push({ sourceIds: [dragSourceId], targetId: up.id, ratio: sendRatio });
    } else {
      // clique simples na própria base = alterna seleção
      if (selection.has(dragSourceId)) selection.delete(dragSourceId);
      else selection.add(dragSourceId);
    }
  } else if (box) {
    if (moved) {
      selection.clear();
      for (const n of state.nodes) {
        if (
          n.owner === 'you' &&
          n.x >= box.x &&
          n.x <= box.x + box.w &&
          n.y >= box.y &&
          n.y <= box.y + box.h
        ) {
          selection.add(n.id);
        }
      }
    } else if (up && selection.size > 0) {
      pendingSends.push({ sourceIds: [...selection], targetId: up.id, ratio: sendRatio });
    } else {
      selection.clear();
    }
  }
  dragSourceId = null;
  box = null;
  boxStart = null;
  downPos = null;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.key === '1') sendRatio = 0.25;
  else if (e.key === '2') sendRatio = 0.5;
  else if (e.key === '3') sendRatio = 0.75;
  else if (e.key === '4') sendRatio = 1.0;
  else if (e.key.toLowerCase() === 'u') {
    for (const id of selection) pendingUpgrades.push({ nodeId: id });
  } else if (e.key.toLowerCase() === 'r') {
    // R = nova seed; Shift+R = MESMA seed (replay determinístico).
    newMatch(e.shiftKey ? seed : (Math.random() * 0xffffffff) >>> 0);
  } else if (e.key.toLowerCase() === 'g') {
    // G = cicla dificuldade e reinicia a partida com a MESMA seed.
    const i = DIFFICULTY_ORDER.indexOf(difficulty);
    difficulty = DIFFICULTY_ORDER[(i + 1) % DIFFICULTY_ORDER.length]!;
    newMatch(seed);
  } else if (e.key === ' ') {
    paused = !paused;
    e.preventDefault();
  } else if (e.key.toLowerCase() === 'f') {
    fog = !fog;
  } else if (e.key.toLowerCase() === 'o') {
    debugVisible = !debugVisible;
  } else if (e.key === 'Tab') {
    e.preventDefault();
    dialIndex = (dialIndex + 1) % DIALS.length;
  } else if (e.key === '-') {
    const d = DIALS[dialIndex]!;
    d.set(d.get() - d.step);
  } else if (e.key === '=') {
    const d = DIALS[dialIndex]!;
    d.set(d.get() + d.step);
  }
});

// ===== Loop =====
function collectInputs(): Inputs {
  const inputs: Inputs = {
    sends: pendingSends.length ? pendingSends : undefined,
    upgrades: pendingUpgrades.length ? pendingUpgrades : undefined,
  };
  pendingSends = [];
  pendingUpgrades = [];
  return inputs;
}

let last = performance.now();
function frame(now: number): void {
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 0.05); // clamp p/ não "teleportar" frotas após um stutter
  recordFrame(dt);

  if (!paused && !state.gameOver) {
    step(state, collectInputs(), dt);
  } else {
    // pausado/fim: ainda assim NÃO perde as ordens; ficam na fila p/ quando despausar.
  }

  const ui: UiState = {
    selection,
    mouseWorld,
    dragSourceId,
    box,
    sendRatio,
    paused,
    fog,
    debug: debugVisible
      ? {
          visible: true,
          fps: avgFps(),
          dials: DIALS.map((d) => ({ name: d.name, value: d.get() })),
          dialIndex,
        }
      : undefined,
  };
  render(ctx, view, state, ui);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
