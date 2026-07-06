import {
  createInitialState,
  step,
  visibleNodeIds,
  type GameState,
  type Inputs,
  type SendOrder,
  type UpgradeOrder,
} from '@conquista/sim';
import {
  CFG,
  TIERS,
  BASE_KINDS,
  UPGRADE,
  ENGAGE,
  NEUTRAL,
  SUPPLY,
  CORE,
  FOG,
  DIFFICULTY_ORDER,
  type Difficulty,
} from '@conquista/shared';
import { computeView, toWorld, render, type View, type UiState, type GhostInfo } from './render.js';
import { ensureAudio, sfx, toggleMute, isMuted } from './audio.js';

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

// F3 — telas: o jogo abre num MENU (o mapa da partida fica visível ao fundo,
// congelado); clique/Espaço/Enter começa. Não há volta ao menu no meio (R basta).
let screen: 'menu' | 'playing' = 'menu';

// F3 — onboarding: dicas contextuais SÓ na primeira partida (persistido).
const TIPS_KEY = 'conquista-tips-done';
let tipsEnabled = true;
try {
  tipsEnabled = localStorage.getItem(TIPS_KEY) !== '1';
} catch {
  /* sem storage: mostra as dicas nesta sessão */
}
let tipStage = 0;
let tipStart: number | null = null;
let firstSendDone = false;
let firstUpgradeDone = false;

/** Dica ativa do onboarding (F3): avança por gesto do jogador ou por tempo. */
function currentTip(): string | null {
  if (!tipsEnabled || state.gameOver) return null;
  if (tipStart === null) tipStart = state.time;
  const elapsed = state.time - tipStart;
  const advance = (): null => {
    tipStage++;
    tipStart = state.time;
    if (tipStage > 3) {
      tipsEnabled = false;
      try {
        localStorage.setItem(TIPS_KEY, '1');
      } catch {
        /* ok */
      }
    }
    return null;
  };
  switch (tipStage) {
    case 0:
      if (firstSendDone || elapsed > 12) return advance();
      return elapsed > 0.5 ? 'ARRASTE de uma base sua até um alvo para enviar tropas' : null;
    case 1:
      if (firstUpgradeDone || elapsed > 9) return advance();
      return 'Segurando o arrasto, aperte SHIFT para fixar um DESVIO na rota (flanquear canhões!)';
    case 2:
      if (firstUpgradeDone || elapsed > 10) return advance();
      return 'Clique numa base sua e aperte U (ou Z/X/C) para EVOLUIR — a obra deixa a base vulnerável';
    case 3:
      if (elapsed > 9) return advance();
      return 'Segure a FORTALEZA CENTRAL para vencer por domínio — e cuidado quando a IA a dominar';
    default:
      return null;
  }
}

let selection = new Set<number>();
let sendRatio = CFG.sendDefault;
let paused = false;
// F2.5: névoa LIGADA por padrão — informação imperfeita é regra, não curiosidade.
// A tecla F continua alternando (acessibilidade/playtest).
let fog = true;
const mouseWorld = { x: 0, y: 0 };
let dragSourceId: number | null = null;
// F2.5: ponto de passagem fixado com Shift DURANTE o arrasto (rota vira decisão).
let dragWaypoint: { x: number; y: number } | null = null;
let box: { x: number; y: number; w: number; h: number } | null = null;
let boxStart: { x: number; y: number } | null = null;
let downPos: { x: number; y: number } | null = null;
// F2.5: memória de última visão (ghost) por nó — só apresentação, morre no restart.
let lastSeen = new Map<number, GhostInfo>();

// Fila de ordens do jogador a despachar no próximo step (a sim é a verdade).
let pendingSends: SendOrder[] = [];
let pendingUpgrades: UpgradeOrder[] = [];

// Ecos visuais dos FxEvent da sim (interceptações — F2.5): vivem só na UI, com fade.
let fxFading: Array<{ x: number; y: number; age: number }> = [];
const FX_TTL = 0.45;

// F3 — estado de áudio da partida (apresentação; zera no restart).
let lastCoreSecond = -1;
let endSoundPlayed = false;

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
  { name: 'obra s/nível', get: () => UPGRADE.timePerTier, set: (v) => { UPGRADE.timePerTier = Math.max(0, +v.toFixed(1)); }, step: 1 },
  { name: 'obra vuln ×', get: () => UPGRADE.vulnMul, set: (v) => { UPGRADE.vulnMul = Math.max(1, +v.toFixed(2)); }, step: 0.05 },
  { name: 'engaje raio', get: () => ENGAGE.radius, set: (v) => { ENGAGE.radius = Math.max(0, Math.round(v)); }, step: 2 },
  { name: 'neutra +/s', get: () => NEUTRAL.growthRate, set: (v) => { NEUTRAL.growthRate = Math.max(0, +v.toFixed(2)); }, step: 0.02 },
  { name: 'neutra teto', get: () => NEUTRAL.growthCap, set: (v) => { NEUTRAL.growthCap = Math.max(0, Math.round(v)); }, step: 2 },
  { name: 'atrito %/s', get: () => SUPPLY.attritionPerSec, set: (v) => { SUPPLY.attritionPerSec = Math.max(0, +v.toFixed(3)); }, step: 0.005 },
  { name: 'atrito alc', get: () => SUPPLY.range, set: (v) => { SUPPLY.range = Math.max(0, Math.round(v)); }, step: 10 },
  { name: 'domínio s', get: () => CORE.holdSeconds, set: (v) => { CORE.holdSeconds = Math.max(0, Math.round(v)); }, step: 5 },
];
let dialIndex = 0;

function newMatch(newSeed: number): void {
  seed = newSeed >>> 0;
  state = createInitialState(seed, { difficulty });
  selection = new Set();
  sendRatio = CFG.sendDefault;
  paused = false;
  dragSourceId = null;
  dragWaypoint = null;
  box = null;
  boxStart = null;
  downPos = null;
  pendingSends = [];
  pendingUpgrades = [];
  fxFading = [];
  lastSeen = new Map();
  lastCoreSecond = -1;
  endSoundPlayed = false;
}

/**
 * Teste de visão por PONTO p/ a apresentação (F3): com névoa, só flasha/soa o
 * que está ao alcance das suas bases/frotas; sem névoa, tudo é visível.
 */
function fogSeenTest(): (x: number, y: number) => boolean {
  if (!fog) return () => true;
  const r2 = FOG.sightRadius * FOG.sightRadius;
  const sources: Array<{ x: number; y: number }> = [];
  for (const n of state.nodes) if (n.owner === 'you') sources.push({ x: n.x, y: n.y });
  for (const f of state.fleets) if (f.owner === 'you') sources.push({ x: f.x, y: f.y });
  return (x, y) => {
    for (const s of sources) {
      const dx = x - s.x;
      const dy = y - s.y;
      if (dx * dx + dy * dy <= r2) return true;
    }
    return false;
  };
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
  ensureAudio(); // autoplay policy: o contexto nasce no 1º gesto
  if (screen === 'menu') {
    screen = 'playing'; // o clique que inicia NÃO vira arrasto
    return;
  }
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
      pendingSends.push({
        sourceIds: [dragSourceId],
        targetId: up.id,
        ratio: sendRatio,
        waypoint: dragWaypoint ?? undefined, // F2.5: rota com desvio fixado no Shift
      });
      sfx('send');
      firstSendDone = true;
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
      sfx('send');
      firstSendDone = true;
    } else {
      selection.clear();
    }
  }
  dragSourceId = null;
  dragWaypoint = null;
  box = null;
  boxStart = null;
  downPos = null;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  ensureAudio();
  if (e.key.toLowerCase() === 'm') {
    toggleMute();
    return;
  }
  if (screen === 'menu') {
    // No menu: começar, trocar dificuldade ou rolar outro mapa. Mais nada.
    if (e.key === ' ' || e.key === 'Enter') {
      screen = 'playing';
      e.preventDefault();
    } else if (e.key.toLowerCase() === 'g') {
      const i = DIFFICULTY_ORDER.indexOf(difficulty);
      difficulty = DIFFICULTY_ORDER[(i + 1) % DIFFICULTY_ORDER.length]!;
      newMatch(seed);
    } else if (e.key.toLowerCase() === 'r') {
      newMatch((Math.random() * 0xffffffff) >>> 0);
    }
    return;
  }
  if (e.key === 'Shift' && dragSourceId !== null) {
    // F2.5: fixa (ou refixa) o ponto de passagem no cursor durante o arrasto.
    dragWaypoint = { x: mouseWorld.x, y: mouseWorld.y };
    return;
  }
  if (e.key === '1') sendRatio = 0.25;
  else if (e.key === '2') sendRatio = 0.5;
  else if (e.key === '3') sendRatio = 0.75;
  else if (e.key === '4') sendRatio = 1.0;
  else if (e.key.toLowerCase() === 'u') {
    for (const id of selection) pendingUpgrades.push({ nodeId: id });
    if (selection.size > 0) firstUpgradeDone = true;
  } else if (e.key.toLowerCase() === 'z') {
    // Upgrade ESPECIALIZADO (F2.5): a escolha é do jogador — Z escudo, X veloz, C canhão.
    for (const id of selection) pendingUpgrades.push({ nodeId: id, kind: 'shield' });
    if (selection.size > 0) firstUpgradeDone = true;
  } else if (e.key.toLowerCase() === 'x') {
    for (const id of selection) pendingUpgrades.push({ nodeId: id, kind: 'fast' });
    if (selection.size > 0) firstUpgradeDone = true;
  } else if (e.key.toLowerCase() === 'c') {
    for (const id of selection) pendingUpgrades.push({ nodeId: id, kind: 'cannon' });
    if (selection.size > 0) firstUpgradeDone = true;
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

  if (screen === 'playing' && !paused && !state.gameOver) {
    step(state, collectInputs(), dt);
    // absorve os eventos do step recém-rodado (só aqui: em pausa o step não roda).
    // Sob névoa, só se APRESENTA (flash/som) o que o jogador veria — honestidade.
    const seenAt = fogSeenTest();
    for (const e of state.fx) {
      if (e.kind === 'engage') {
        if (seenAt(e.x, e.y)) {
          fxFading.push({ x: e.x, y: e.y, age: 0 });
          sfx('engage');
        }
      } else if (e.kind === 'capture') {
        if (e.owner === 'you') sfx('captureYou');
        else if (seenAt(e.x, e.y)) sfx('captureEnemy');
      } else if (e.kind === 'upgraded' && e.owner === 'you') {
        sfx('upgraded');
      }
    }
    // alarme de domínio: bipe por segundo na 2ª metade do anel (F3)
    if (state.coreHold.owner && state.coreHold.held / CORE.holdSeconds >= 0.5) {
      const sec = Math.floor(state.coreHold.held);
      if (sec !== lastCoreSecond) {
        lastCoreSecond = sec;
        sfx('coreTick');
      }
    } else {
      lastCoreSecond = -1;
    }
  } else {
    // pausado/fim: ainda assim NÃO perde as ordens; ficam na fila p/ quando despausar.
  }
  if (state.gameOver && !endSoundPlayed) {
    endSoundPlayed = true;
    sfx(state.winner === 'you' ? 'win' : 'lose');
  }
  for (const e of fxFading) e.age += dt;
  fxFading = fxFading.filter((e) => e.age < FX_TTL);

  // F2.5 — névoa honesta: computa a visão UMA vez por frame e alimenta a memória
  // de última visão (ghosts). O que não está visível é desenhado como lembrança.
  const visibleIds = fog ? visibleNodeIds(state, FOG.sightRadius) : null;
  if (visibleIds) {
    for (const n of state.nodes) {
      if (visibleIds.has(n.id)) {
        lastSeen.set(n.id, { owner: n.owner, kind: n.kind, tier: n.tier, troops: n.troops });
      }
    }
  }

  const ui: UiState = {
    selection,
    mouseWorld,
    dragSourceId,
    dragWaypoint,
    box,
    sendRatio,
    paused,
    fog,
    muted: isMuted(),
    menu: screen === 'menu',
    tip: screen === 'playing' ? currentTip() : null,
    visibleIds,
    ghosts: lastSeen,
    fx: fxFading,
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
