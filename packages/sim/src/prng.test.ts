import { describe, it, expect } from 'vitest';
import { mulberry32, nextRng, seedToState } from './prng.js';

describe('PRNG mulberry32', () => {
  it('nextRng (puro) produz a MESMA sequência que mulberry32 (closure)', () => {
    const seed = 123456789;
    const gen = mulberry32(seed);
    let state = seedToState(seed);
    for (let i = 0; i < 1000; i++) {
      const expected = gen();
      const r = nextRng(state);
      expect(r.value).toBe(expected);
      state = r.state;
    }
  });

  it('é determinístico: mesma seed ⇒ mesma sequência', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('produz valores em [0, 1)', () => {
    let state = seedToState(7);
    for (let i = 0; i < 10000; i++) {
      const r = nextRng(state);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      state = r.state;
    }
  });
});
