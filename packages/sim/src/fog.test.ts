import { describe, it, expect } from 'vitest';
import { createInitialState, mkNode, visibleNodeIds, type Fleet } from './index.js';

describe('Névoa de guerra — visibleNodeIds (puro)', () => {
  it('suas bases são sempre visíveis; neutra perto entra, inimiga longe fica oculta', () => {
    const s = createInitialState(1);
    const you = mkNode(0, 500, 300, 'you', 0, 30, 'normal');
    const near = mkNode(1, 600, 300, 'neutral', 0, 10, 'normal'); // dist 100
    const farNode = mkNode(2, 1100, 300, 'enemy', 0, 10, 'normal'); // dist 600
    s.nodes = [you, near, farNode];
    s.fleets = [];
    const vis = visibleNodeIds(s, 230);
    expect(vis.has(0)).toBe(true); // sua base
    expect(vis.has(1)).toBe(true); // neutra a 100 < 230
    expect(vis.has(2)).toBe(false); // inimiga a 600 > 230
  });

  it('uma frota sua revela nós ao redor dela', () => {
    const s = createInitialState(1);
    const you = mkNode(0, 0, 0, 'you', 0, 30, 'normal');
    const target = mkNode(1, 1000, 300, 'enemy', 0, 10, 'normal');
    s.nodes = [you, target];
    const scout: Fleet = { id: 0, owner: 'you', x: 950, y: 300, target: 1, count: 10 };
    s.fleets = [scout]; // a 50px do alvo
    expect(visibleNodeIds(s, 230).has(1)).toBe(true);
  });

  it('não muta o estado (apresentação pura)', () => {
    const s = createInitialState(3);
    const before = JSON.stringify(s);
    visibleNodeIds(s, 230);
    expect(JSON.stringify(s)).toBe(before);
  });
});
