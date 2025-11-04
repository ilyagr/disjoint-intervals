import { describe, test, expect } from 'vitest';
import wasm from './index.js';

describe('TypedArray API (disjoint_intervals_u32)', () => {
  test('basic usage with TypedArray', () => {
    // Input: [0,5), [3,8), [10,15) as flat array
    const input = new Uint32Array([
      0, 5,   // [0,5)
      3, 8,   // [3,8)
      10, 15, // [10,15)
    ]);
    
    const result = wasm.disjoint_intervals_u32(input);
    
    // Should split at boundaries: [0,3), [3,5), [5,8), [10,15)
    expect(result).toEqual(new Uint32Array([
      0, 3,   // [0,3)
      3, 5,   // [3,5)
      5, 8,   // [5,8)
      10, 15, // [10,15)
    ]));
  });

  test('empty input', () => {
    const input = new Uint32Array([]);
    const result = wasm.disjoint_intervals_u32(input);
    expect(result).toEqual(new Uint32Array([]));
  });

  test('single interval', () => {
    const input = new Uint32Array([5, 10]);
    const result = wasm.disjoint_intervals_u32(input);
    expect(result).toEqual(new Uint32Array([5, 10]));
  });

  test('non-overlapping intervals', () => {
    const input = new Uint32Array([
      0, 5,
      10, 15,
      20, 25,
    ]);
    const result = wasm.disjoint_intervals_u32(input);
    expect(result).toEqual(new Uint32Array([
      0, 5,
      10, 15,
      20, 25,
    ]));
  });

  test('completely overlapping intervals', () => {
    const input = new Uint32Array([
      0, 20,  // [0,20)
      5, 10,  // [5,10)
      12, 15, // [12,15)
    ]);
    const result = wasm.disjoint_intervals_u32(input);
    
    // Splits at: 0,5,10,12,15,20
    expect(result).toEqual(new Uint32Array([
      0, 5,
      5, 10,
      10, 12,
      12, 15,
      15, 20,
    ]));
  });

  test('produces same results as object API', () => {
    const intervals = [
      { start: 0, end: 5 },
      { start: 3, end: 8 },
      { start: 10, end: 15 },
      { start: 12, end: 20 },
    ];
    
    // Object API
    const objResult = wasm.disjoint_intervals_obj(intervals);
    
    // TypedArray API
    const typedInput = new Uint32Array(intervals.flatMap(i => [i.start, i.end]));
    const typedResult = wasm.disjoint_intervals_u32(typedInput);
    
    // Convert object result to flat array for comparison
    const objFlat = new Uint32Array(
      Array.from(objResult).flatMap((obj: any) => [obj.start, obj.end])
    );
    
    expect(typedResult).toEqual(objFlat);
  });

  test('large dataset', () => {
    // Generate 1000 overlapping intervals
    const intervals: number[] = [];
    for (let i = 0; i < 1000; i++) {
      intervals.push(i, i + 10);
    }
    const input = new Uint32Array(intervals);
    
    const result = wasm.disjoint_intervals_u32(input);
    
    // Should produce segments from 0 to 1009
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toBe(0); // First segment starts at 0
    expect(result[result.length - 1]).toBe(1009); // Last segment ends at 1009
  });
});
