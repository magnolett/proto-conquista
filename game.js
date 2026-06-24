'use strict';
/*
 * CONQUISTA — protótipo de RTS em tempo real (estilo Galcon/Auralux)
 * 100% código, zero modelagem: tudo são círculos, linhas e luz (canvas 2D).
 * A profundidade vem da SIMULAÇÃO (economia, expansão, timing, multi-frente),
 * não dos gráficos. É o oposto de um shooter de reflexo.
 *
 * Regras:
 *  - Cada BASE (círculo) tem dono (você=ciano, IA=laranja, neutra=cinza) e tropas.
 *  - Suas bases PRODUZEM tropas até um teto (cap). Quanto maior o TIER, mais produz.
 *  - Enviar tropas: ARRASTE de uma base sua até qualquer base (ataca ou reforça).
 *  - A distância importa: a frota viaja em velocidade fixa (geometria = estratégia).
 *  - Capturar = chegar com mais tropas do que a defesa do alvo.
 *  - Vence quem eliminar o outro.
 */

// ===== Canvas =====
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0;
function resize(){ W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

// ===== Paleta (coesa e "tática", não neon de festa) =====
const COL = {
  bg: '#0a0e1a',
  grid: 'rgba(120,160,255,0.05)',
  you: '#39d8ff',
  enemy: '#ff7a4a',
  neutral: '#7a869c',
  text: '#eaf2ff',
};
function ownerColor(o){ return o === 'you' ? COL.you : o === 'enemy' ? COL.enemy : COL.neutral; }

// ===== Balanceamento (tudo ajustável — é aqui que a gente vai iterar) =====
const CFG = { fleetSpeed: 135, aiTick: 0.7, sendDefault: 0.5 };
const TIERS = [
  { prod: 1.0, cap: 30, r: 20 }, // T1
  { prod: 1.9, cap: 58, r: 27 }, // T2
  { prod: 3.2, cap: 95, r: 34 }, // T3
];
function applyTier(n){ const t = TIERS[Math.min(n.tier, TIERS.length - 1)]; n.prod = t.prod; n.cap = t.cap; n.radius = t.r; }
function upgradeCost(n){ return Math.round(20 * (n.tier + 1)); } // T1->20, T2->40

// ===== Estado =====
let nodes = [], fleets = [];
let selection = new Set();
let sendRatio = CFG.sendDefault;
let paused = false, gameOver = false, winner = null;
let aiTimer = 0, time = 0;
const mouse = { x: 0, y: 0 };
let dragSource = null, box = null, boxStart = null, downPos = null;

// ===== Criação de bases / mapa espelhado (partida justa) =====
function mkNode(x, y, owner, tier, troops){
  const n = { id: nodes.length, x, y, owner, tier, troops, sel: false, underAttack: false, pulse: 0 };
  applyTier(n);
  return n;
}

function newMatch(){
  nodes = []; fleets = []; selection.clear();
  gameOver = false; winner = null; sendRatio = CFG.sendDefault;
  aiTimer = 0; time = 0; dragSource = null; box = null; boxStart = null;

  const cx = W / 2, cy = H / 2;
  const mirror = (x, y) => ({ x: W - x, y: H - y });
  const placed = [];
  const minDist = 115;
  const farEnough = (x, y) =>
    placed.every(p => Math.hypot(p.x - x, p.y - y) > minDist) &&
    Math.hypot((W - x) - x, (H - y) - y) > minDist * 0.7;

  // Base do jogador (canto inferior-esquerdo) e seu espelho = base da IA
  const bx = 120 + Math.random() * 120;
  const by = H - 140 - Math.random() * 110;
  nodes.push(mkNode(bx, by, 'you', 0, 22)); placed.push({ x: bx, y: by });
  const mb = mirror(bx, by);
  nodes.push(mkNode(mb.x, mb.y, 'enemy', 0, 22)); placed.push(mb);

  // Base central contestada (no eixo de simetria → é o próprio espelho)
  nodes.push(mkNode(cx, cy, 'neutral', 2, 42)); placed.push({ x: cx, y: cy });

  // Pares de bases neutras espelhadas
  let made = 0, tries = 0;
  while (made < 4 && tries < 500){
    tries++;
    const x = 140 + Math.random() * (W - 280);
    const y = 120 + Math.random() * (H - 240);
    if (((x - cx) + (y - cy)) > -40) continue; // manter no lado do jogador p/ espelhar
    if (!farEnough(x, y)) continue;
    const m = mirror(x, y);
    if (!placed.every(p => Math.hypot(p.x - m.x, p.y - m.y) > minDist)) continue;
    const tier = Math.random() < 0.25 ? 2 : (Math.random() < 0.5 ? 1 : 0);
    const def = tier === 2 ? 36 : tier === 1 ? 20 : 9;
    nodes.push(mkNode(x, y, 'neutral', tier, def)); placed.push({ x, y });
    nodes.push(mkNode(m.x, m.y, 'neutral', tier, def)); placed.push(m);
    made++;
  }
}

// ===== Envio de tropas =====
function spawnFleet(sn, tn, owner, count){
  const dx = tn.x - sn.x, dy = tn.y - sn.y, d = Math.hypot(dx, dy) || 1;
  fleets.push({ owner, x: sn.x + dx / d * sn.radius, y: sn.y + dy / d * sn.radius, target: tn.id, count, dead: false });
}
function sendFrom(sourceIds, targetId){
  for (const sid of sourceIds){
    if (sid === targetId) continue;
    const sn = nodes[sid];
    if (!sn || sn.owner !== 'you') continue;
    const count = Math.floor(sn.troops * sendRatio);
    if (count < 1) continue;
    sn.troops -= count;
    spawnFleet(sn, nodes[targetId], 'you', count);
  }
}
function resolveArrival(f, tn){
  if (tn.owner === f.owner){
    tn.troops += f.count; // reforço (pode passar do cap; produção só cresce abaixo do cap)
  } else {
    tn.troops -= f.count;
    if (tn.troops < 0){ tn.owner = f.owner; tn.troops = -tn.troops; tn.pulse = 1; } // captura
    else { tn.pulse = 0.5; }
  }
}
function upgradeNode(n){
  if (!n || n.tier >= TIERS.length - 1) return;
  const cost = upgradeCost(n);
  if (n.troops < cost) return;
  n.troops -= cost; n.tier++; applyTier(n); n.pulse = 1;
}

// ===== IA (defende, expande, dá upgrade — heurística, não trapaça) =====
function dist(a, b){ return Math.hypot(a.x - b.x, a.y - b.y); }
function aiThink(){
  const mine = nodes.filter(n => n.owner === 'enemy');
  if (mine.length === 0) return;

  // tropas suas a caminho de cada base da IA (ameaça percebida)
  const incoming = {};
  for (const f of fleets){
    if (f.owner === 'you'){
      const t = nodes[f.target];
      if (t.owner === 'enemy') incoming[t.id] = (incoming[t.id] || 0) + f.count;
    }
  }

  // 1) DEFESA: base ameaçada recebe reforço do vizinho forte mais próximo
  for (const n of mine){
    if ((incoming[n.id] || 0) > n.troops * 0.9){
      const helper = mine.filter(m => m.id !== n.id && m.troops > 16).sort((a, b) => dist(a, n) - dist(b, n))[0];
      if (helper){ const c = Math.floor(helper.troops * 0.6); if (c >= 1){ helper.troops -= c; spawnFleet(helper, n, 'enemy', c); } }
    }
  }

  // 2) ATAQUE/EXPANSÃO: base com excedente mira o alvo mais valioso e barato
  const attackers = mine.filter(n => n.troops > n.cap * 0.6).sort((a, b) => b.troops - a.troops);
  for (const a of attackers){
    let best = null, bestScore = -Infinity;
    for (const t of nodes){
      if (t.owner === 'enemy') continue;
      const force = Math.floor(a.troops * 0.6);
      if (force <= t.troops + 1) continue; // só ataca o que consegue tomar
      const score = t.tier * 45 - t.troops - dist(a, t) * 0.15 + (t.owner === 'you' ? 25 : 0);
      if (score > bestScore){ bestScore = score; best = t; }
    }
    if (best){ const c = Math.floor(a.troops * 0.6); a.troops -= c; spawnFleet(a, best, 'enemy', c); }
  }

  // 3) ECONOMIA: às vezes faz upgrade de uma base segura da retaguarda
  if (Math.random() < 0.35){
    const safe = mine.filter(n => n.troops >= upgradeCost(n) && !(incoming[n.id] > 0)).sort((a, b) => a.tier - b.tier)[0];
    if (safe) upgradeNode(safe);
  }
}

// ===== Loop de simulação =====
function update(dt){
  time += dt;
  for (const n of nodes){
    n.underAttack = false;
    if (n.pulse > 0) n.pulse = Math.max(0, n.pulse - dt * 1.5);
    if (n.owner !== 'neutral' && n.troops < n.cap) n.troops = Math.min(n.cap, n.troops + n.prod * dt);
  }
  for (const f of fleets){
    const tn = nodes[f.target];
    const dx = tn.x - f.x, dy = tn.y - f.y, d = Math.hypot(dx, dy) || 0.0001;
    const step = CFG.fleetSpeed * dt;
    if (d <= step + tn.radius * 0.4){ resolveArrival(f, tn); f.dead = true; }
    else { f.x += dx / d * step; f.y += dy / d * step; }
  }
  fleets = fleets.filter(f => !f.dead);
  for (const f of fleets){ const tn = nodes[f.target]; if (tn.owner !== f.owner) tn.underAttack = true; }
  if (!gameOver){ aiTimer -= dt; if (aiTimer <= 0){ aiTimer = CFG.aiTick; aiThink(); } }
  checkWin();
}
function checkWin(){
  const youHas = nodes.some(n => n.owner === 'you') || fleets.some(f => f.owner === 'you');
  const enHas = nodes.some(n => n.owner === 'enemy') || fleets.some(f => f.owner === 'enemy');
  if (!enHas){ gameOver = true; winner = 'you'; }
  else if (!youHas){ gameOver = true; winner = 'enemy'; }
}

// ===== Render =====
function line(x1, y1, x2, y2){ ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function drawGrid(){
  ctx.strokeStyle = COL.grid; ctx.lineWidth = 1; const g = 60; ctx.beginPath();
  for (let x = 0; x < W; x += g){ ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y < H; y += g){ ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
}
function drawGuides(){
  ctx.save(); ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5;
  if (dragSource){ ctx.strokeStyle = 'rgba(57,216,255,0.75)'; line(dragSource.x, dragSource.y, mouse.x, mouse.y); }
  else if (selection.size > 0){ ctx.strokeStyle = 'rgba(57,216,255,0.4)'; for (const id of selection){ const n = nodes[id]; line(n.x, n.y, mouse.x, mouse.y); } }
  ctx.restore();
}
function drawFleet(f){
  const tn = nodes[f.target];
  const ang = Math.atan2(tn.y - f.y, tn.x - f.x);
  const c = ownerColor(f.owner);
  const s = 3 + Math.sqrt(f.count);
  ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(ang);
  ctx.shadowColor = c; ctx.shadowBlur = 10; ctx.fillStyle = c;
  ctx.beginPath(); ctx.moveTo(s * 1.6, 0); ctx.lineTo(-s, s * 0.8); ctx.lineTo(-s, -s * 0.8); ctx.closePath(); ctx.fill();
  ctx.restore();
  if (f.count >= 10){ ctx.fillStyle = c; ctx.font = '10px system-ui,Arial'; ctx.textAlign = 'center'; ctx.fillText(f.count, f.x, f.y - 11); }
}
function drawNode(n){
  const c = ownerColor(n.owner);
  ctx.save();
  ctx.shadowColor = c; ctx.shadowBlur = 16 + n.pulse * 30;
  ctx.beginPath(); ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10,16,30,0.92)'; ctx.fill();
  ctx.lineWidth = 3 + n.tier; ctx.strokeStyle = c; ctx.stroke();
  ctx.restore();
  if (n.underAttack){
    ctx.save(); ctx.strokeStyle = 'rgba(255,90,70,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(n.x, n.y, n.radius + 6, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  if (n.sel){
    ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.radius + 10, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  ctx.fillStyle = COL.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold ' + Math.max(12, Math.floor(n.radius * 0.8)) + 'px system-ui,Segoe UI,Arial';
  ctx.fillText(Math.floor(n.troops), n.x, n.y);
  ctx.fillStyle = 'rgba(234,242,255,0.5)'; ctx.font = '10px system-ui,Arial';
  ctx.fillText('T' + (n.tier + 1), n.x, n.y + n.radius + 12);
}
function drawHUD(){
  const you = nodes.filter(n => n.owner === 'you');
  const en = nodes.filter(n => n.owner === 'enemy');
  const yt = Math.round(you.reduce((s, n) => s + n.troops, 0));
  const et = Math.round(en.reduce((s, n) => s + n.troops, 0));
  ctx.save(); ctx.textBaseline = 'top';
  ctx.textAlign = 'left'; ctx.font = 'bold 16px system-ui,Arial'; ctx.fillStyle = COL.you;
  ctx.fillText('VOCÊ  ' + you.length + ' bases · ' + yt + ' tropas', 16, 14);
  ctx.textAlign = 'right'; ctx.fillStyle = COL.enemy;
  ctx.fillText(en.length + ' bases · ' + et + ' tropas  IA', W - 16, 14);
  ctx.textAlign = 'center'; ctx.fillStyle = COL.text; ctx.font = '14px system-ui,Arial';
  ctx.fillText('Força de envio: ' + Math.round(sendRatio * 100) + '%' + (paused ? '   — PAUSA' : ''), W / 2, 16);
  ctx.fillStyle = 'rgba(234,242,255,0.55)'; ctx.font = '12px system-ui,Arial';
  ctx.fillText('arraste de uma base sua → enviar   |   caixa de seleção + clique no alvo = multi-envio   |   [1-4] força   [U] upgrade   [Espaço] pausa   [R] reiniciar', W / 2, H - 22);
  ctx.restore();
}
function drawBanner(){
  ctx.save(); ctx.fillStyle = 'rgba(5,8,16,0.72)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = winner === 'you' ? COL.you : COL.enemy; ctx.font = 'bold 54px system-ui,Arial';
  ctx.fillText(winner === 'you' ? 'VITÓRIA' : 'DERROTA', W / 2, H / 2 - 20);
  ctx.fillStyle = COL.text; ctx.font = '18px system-ui,Arial';
  ctx.fillText('pressione R para uma nova partida', W / 2, H / 2 + 30);
  ctx.restore();
}
function render(){
  ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H);
  drawGrid();
  drawGuides();
  for (const f of fleets) drawFleet(f);
  for (const n of nodes) drawNode(n);
  if (box && (box.w > 2 || box.h > 2)){
    ctx.save(); ctx.fillStyle = 'rgba(120,200,255,0.08)'; ctx.strokeStyle = 'rgba(120,200,255,0.5)';
    ctx.fillRect(box.x, box.y, box.w, box.h); ctx.strokeRect(box.x, box.y, box.w, box.h); ctx.restore();
  }
  drawHUD();
  if (gameOver) drawBanner();
}

// ===== Entrada =====
function pos(e){ const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function nodeAt(p){ for (const n of nodes){ if (Math.hypot(n.x - p.x, n.y - p.y) <= n.radius + 4) return n; } return null; }
function syncSel(){ for (const n of nodes) n.sel = selection.has(n.id); }

canvas.addEventListener('mousedown', e => {
  if (gameOver) return;
  const p = pos(e); downPos = p; mouse.x = p.x; mouse.y = p.y;
  const n = nodeAt(p);
  if (n && n.owner === 'you'){ dragSource = n; box = null; boxStart = null; }
  else { boxStart = p; box = { x: p.x, y: p.y, w: 0, h: 0 }; dragSource = null; }
});
canvas.addEventListener('mousemove', e => {
  const p = pos(e); mouse.x = p.x; mouse.y = p.y;
  if (box && boxStart){
    box.x = Math.min(boxStart.x, p.x); box.y = Math.min(boxStart.y, p.y);
    box.w = Math.abs(p.x - boxStart.x); box.h = Math.abs(p.y - boxStart.y);
  }
});
canvas.addEventListener('mouseup', e => {
  if (gameOver){ dragSource = null; box = null; boxStart = null; return; }
  const p = pos(e);
  const moved = downPos && Math.hypot(p.x - downPos.x, p.y - downPos.y) > 6;
  const up = nodeAt(p);
  if (dragSource){
    if (moved && up && up.id !== dragSource.id) sendFrom([dragSource.id], up.id); // arraste = enviar
    else { // clique simples na própria base = alternar seleção
      if (selection.has(dragSource.id)) selection.delete(dragSource.id); else selection.add(dragSource.id);
    }
  } else if (box){
    if (moved){ // caixa de seleção
      selection.clear();
      for (const n of nodes) if (n.owner === 'you' && n.x >= box.x && n.x <= box.x + box.w && n.y >= box.y && n.y <= box.y + box.h) selection.add(n.id);
    } else if (up && selection.size > 0){ sendFrom([...selection], up.id); } // clique no alvo = multi-envio
    else { selection.clear(); }
  }
  dragSource = null; box = null; boxStart = null; downPos = null; syncSel();
});
window.addEventListener('keydown', e => {
  if (e.key === '1') sendRatio = 0.25;
  else if (e.key === '2') sendRatio = 0.5;
  else if (e.key === '3') sendRatio = 0.75;
  else if (e.key === '4') sendRatio = 1.0;
  else if (e.key.toLowerCase() === 'u'){ for (const id of selection) upgradeNode(nodes[id]); }
  else if (e.key.toLowerCase() === 'r') newMatch();
  else if (e.key === ' '){ paused = !paused; e.preventDefault(); }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ===== Boot =====
let last = performance.now();
function frame(now){
  let dt = (now - last) / 1000; last = now; dt = Math.min(dt, 0.05);
  if (!paused && !gameOver) update(dt);
  render();
  requestAnimationFrame(frame);
}
newMatch();
requestAnimationFrame(frame);
