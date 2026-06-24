import { describe, it, expect } from 'vitest';
import { createInitialState, step, mkNode, spawnFleet, zoneMulAt, type Zone } from './index.js';

describe('Modificadores de mapa — zoneMulAt (puro)', () => {
  it('ponto dentro de uma zona usa o speedMul dela; fora ⇒ 1', () => {
    const zones: Zone[] = [{ x: 100, y: 100, radius: 50, speedMul: 1.5 }];
    expect(zoneMulAt(100, 100, zones)).toBe(1.5); // centro
    expect(zoneMulAt(140, 100, zones)).toBe(1.5); // dentro (dist 40 < 50)
    expect(zoneMulAt(200, 200, zones)).toBe(1); // fora
    expect(zoneMulAt(100, 100, undefined)).toBe(1); // sem zonas
  });

  it('zonas sobrepostas multiplicam', () => {
    const zones: Zone[] = [
      { x: 0, y: 0, radius: 100, speedMul: 1.5 },
      { x: 0, y: 0, radius: 100, speedMul: 0.6 },
    ];
    expect(zoneMulAt(0, 0, zones)).toBeCloseTo(0.9, 6); // 1.5 * 0.6
  });
});

describe('Modificadores de mapa — efeito no movimento', () => {
  const advance = (speedMul: number): number => {
    const s = createInitialState(1);
    const src = mkNode(0, 100, 300, 'you', 0, 50, 'normal');
    const tgt = mkNode(1, 1100, 300, 'neutral', 0, 10, 'normal');
    s.nodes = [src, tgt];
    s.fleets = [];
    s.nextFleetId = 0;
    s.zones = [{ x: 200, y: 300, radius: 250, speedMul }]; // cobre o trajeto inicial
    spawnFleet(s, src, tgt, 'you', 20);
    step(s, undefined, 0.1);
    return s.fleets[0]!.x;
  };

  it('estrada acelera e lamaçal atrasa em relação à zona neutra', () => {
    expect(advance(1.5)).toBeGreaterThan(advance(1));
    expect(advance(0.6)).toBeLessThan(advance(1));
  });
});

describe('Modificadores de mapa — geração', () => {
  it('mapgen gera zonas espelhadas e determinísticas', () => {
    const a = createInitialState(0xc0ffee);
    const b = createInitialState(0xc0ffee);
    expect(a.zones).toEqual(b.zones); // determinístico
    expect(a.zones!.length).toBeGreaterThanOrEqual(2);
    // pares espelhados: cada 2 zonas consecutivas têm mesmo speedMul/radius.
    for (let i = 0; i + 1 < a.zones!.length; i += 2) {
      expect(a.zones![i]!.speedMul).toBe(a.zones![i + 1]!.speedMul);
      expect(a.zones![i]!.radius).toBe(a.zones![i + 1]!.radius);
    }
  });
});
