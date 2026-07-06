/**
 * Áudio sintetizado (F3) — ZERO asset: osciladores + ruído + envelopes.
 * Regras:
 *  - o AudioContext nasce no PRIMEIRO gesto do usuário (autoplay policy);
 *  - cada tipo de som tem cooldown próprio (um all-in não vira metralhadora);
 *  - mute (tecla M) persiste em localStorage;
 *  - módulo de APRESENTAÇÃO: nunca decide regra, só reage a eventos.
 */

export type SfxKind =
  | 'send'
  | 'engage'
  | 'captureYou'
  | 'captureEnemy'
  | 'reinforce'
  | 'upgraded'
  | 'coreTick'
  | 'win'
  | 'lose';

const MUTE_KEY = 'conquista-muted';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  /* storage indisponível (iframe/priv): segue com som ligado */
}

const lastPlay = new Map<SfxKind, number>();
/** Cooldown por tipo (ms) — evita rajadas no mesmo instante. */
const COOLDOWN: Record<SfxKind, number> = {
  send: 60,
  engage: 90,
  captureYou: 120,
  captureEnemy: 120,
  reinforce: 90,
  upgraded: 150,
  coreTick: 700,
  win: 1000,
  lose: 1000,
};

/** Cria o contexto no primeiro gesto (chamar de mousedown/keydown). Idempotente. */
export function ensureAudio(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  try {
    ctx = new AudioContext();
  } catch {
    return; // sem WebAudio: jogo segue mudo
  }
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  // buffer de ruído branco (0,2 s) p/ percussão de combate
  noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* sem storage: só não persiste */
  }
  return muted;
}

/** Tom com envelope AD simples. */
function tone(
  type: OscillatorType,
  f0: number,
  f1: number,
  dur: number,
  peak: number,
  when = 0,
): void {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Rajada de ruído filtrado (percussão). */
function noise(dur: number, peak: number, freq: number): void {
  if (!ctx || !master || !noiseBuf) return;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** Dispara um som do jogo (respeita mute e cooldown por tipo). */
export function sfx(kind: SfxKind): void {
  if (muted || !ctx || !master) return;
  const now = performance.now();
  const last = lastPlay.get(kind) ?? -Infinity;
  if (now - last < COOLDOWN[kind]) return;
  lastPlay.set(kind, now);

  switch (kind) {
    case 'send':
      tone('sine', 380, 540, 0.07, 0.1);
      break;
    case 'reinforce':
      tone('sine', 520, 520, 0.06, 0.08);
      break;
    case 'engage':
      noise(0.09, 0.14, 900);
      tone('square', 150, 90, 0.09, 0.07);
      break;
    case 'captureYou':
      tone('triangle', 523, 523, 0.09, 0.14);
      tone('triangle', 784, 784, 0.12, 0.12, 0.07);
      break;
    case 'captureEnemy':
      tone('sawtooth', 300, 170, 0.2, 0.1);
      break;
    case 'upgraded':
      tone('triangle', 660, 880, 0.15, 0.12);
      break;
    case 'coreTick':
      tone('square', 880, 880, 0.05, 0.09);
      break;
    case 'win':
      tone('triangle', 523, 523, 0.14, 0.16);
      tone('triangle', 659, 659, 0.14, 0.16, 0.12);
      tone('triangle', 784, 784, 0.3, 0.18, 0.24);
      break;
    case 'lose':
      tone('sawtooth', 220, 220, 0.2, 0.12);
      tone('sawtooth', 147, 110, 0.5, 0.12, 0.16);
      break;
  }
}
