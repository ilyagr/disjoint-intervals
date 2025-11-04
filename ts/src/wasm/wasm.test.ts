import { describe, test, expect } from 'vitest';
import wasm from './index.js';

// Helper to convert intervals to WASM format
function toWasmIntervals(intervals: Array<[number, number]>): Array<{ start: number; end: number }> {
  return intervals.map(([start, end]) => ({ start, end }));
}

// Helper to convert WASM output to comparable format
function fromWasmIntervals(result: any): Array<[number, number]> {
  return Array.from(result).map((obj: any) => [obj.start, obj.end] as [number, number]);
}

describe('WASM SplitIntoDisjointRanges basic', () => {
  test('empty input', () => {
    const input: Array<{ start: number; end: number }> = [];
    const out = wasm.disjoint_intervals_obj(input);
    expect(fromWasmIntervals(out)).toEqual([]);
  });

  test('single non-empty interval', () => {
    const input = toWasmIntervals([[0, 5]]);
    const out = fromWasmIntervals(wasm.disjoint_intervals_obj(input));
    expect(out).toEqual([[0, 5]]);
  });

  test('single empty interval becomes 0-length segment', () => {
    const input = toWasmIntervals([[5, 5]]);
    const out = fromWasmIntervals(wasm.disjoint_intervals_obj(input));
    expect(out).toEqual([[5, 5]]);
  });
});

describe('WASM Edge behaviors', () => {
  test('many same start including empties', () => {
    const input = toWasmIntervals([[5, 5], [5, 7], [5, 10], [5, 6]]);
    const out = fromWasmIntervals(wasm.disjoint_intervals_obj(input));
    expect(out).toEqual([
      [5, 5],
      [5, 6],
      [6, 7],
      [7, 10],
    ]);
  });

  test('identical end points drop all at boundary', () => {
    const input = toWasmIntervals([[0, 5], [3, 5], [4, 5], [5, 8]]);
    const out = fromWasmIntervals(wasm.disjoint_intervals_obj(input));
    expect(out).toEqual([
      [0, 3],
      [3, 4],
      [4, 5],
      [5, 8],
    ]);
  });

  test('unsorted input should handle gracefully or panic', () => {
    // The Rust implementation panics on unsorted input
    // WASM panics will throw errors in JS
    const input = toWasmIntervals([[2, 3], [0, 1]]);
    expect(() => wasm.disjoint_intervals_obj(input)).toThrow();
  });

  test('inverted interval panics', () => {
    // Inverted intervals should cause assertion failure
    const input = [{ start: 5, end: 3 }];
    expect(() => wasm.disjoint_intervals_obj(input)).toThrow();
  });
});

describe('WASM Parity with Rust tests', () => {
  test('handling of empty intervals at start points', () => {
    const input = toWasmIntervals([
      [0, 5],
      [4, 6],
      [5, 5],
      [5, 7],
      [7, 7],
      [10, 10],
      [10, 11],
    ]);
    const out = fromWasmIntervals(wasm.disjoint_intervals_obj(input));
    expect(out).toEqual([
      [0, 4],
      [4, 5],
      [5, 5],
      [5, 6],
      [6, 7],
      [7, 7],
      [10, 10],
      [10, 11],
    ]);
  });

  test('larger composite example', () => {
    const input = toWasmIntervals([
      [0, 5],
      [2, 2],
      [3, 8],
      [8, 9],
      [8, 8],
      [10, 15],
      [12, 20],
      [20, 25],
      [22, 30],
      [23, 35],
    ]);
    const out = fromWasmIntervals(wasm.disjoint_intervals_obj(input));
    expect(out).toEqual([
      [0, 2],
      [2, 2],
      [2, 3],
      [3, 5],
      [5, 8],
      [8, 8],
      [8, 9],
      [10, 12],
      [12, 15],
      [15, 20],
      [20, 22],
      [22, 23],
      [23, 25],
      [25, 30],
      [30, 35],
    ]);
  });
});

describe('WASM Additional test cases', () => {
  test('overlapping intervals', () => {
    const input = toWasmIntervals([[0, 5], [3, 8], [10, 15]]);
    const out = fromWasmIntervals(wasm.disjoint_intervals_obj(input));
    expect(out).toEqual([
      [0, 3],
      [3, 5],
      [5, 8],
      [10, 15],
    ]);
  });

  test('adjacent non-overlapping intervals', () => {
    const input = toWasmIntervals([[0, 5], [5, 10], [10, 15]]);
    const out = fromWasmIntervals(wasm.disjoint_intervals_obj(input));
    expect(out).toEqual([
      [0, 5],
      [5, 10],
      [10, 15],
    ]);
  });

  test('completely disjoint intervals', () => {
    const input = toWasmIntervals([[0, 5], [10, 15], [20, 25]]);
    const out = fromWasmIntervals(wasm.disjoint_intervals_obj(input));
    expect(out).toEqual([
      [0, 5],
      [10, 15],
      [20, 25],
    ]);
  });

  test('nested intervals', () => {
    const input = toWasmIntervals([[0, 10], [2, 8], [4, 6]]);
    const out = fromWasmIntervals(wasm.disjoint_intervals_obj(input));
    expect(out).toEqual([
      [0, 2],
      [2, 4],
      [4, 6],
      [6, 8],
      [8, 10],
    ]);
  });

  test('multiple empty intervals at same position', () => {
    const input = toWasmIntervals([[5, 5], [5, 5], [5, 10]]);
    const out = fromWasmIntervals(wasm.disjoint_intervals_obj(input));
    expect(out).toEqual([
      [5, 5],
      [5, 10],
    ]);
  });
});

describe('WASM Stress tests', () => {
  test('many overlapping intervals', () => {
    const input = toWasmIntervals(
      Array.from({ length: 100 }, (_, i) => [i, i + 10] as [number, number])
    );
    const out = fromWasmIntervals(wasm.disjoint_intervals_obj(input));
    // Should create many small disjoint segments
    expect(out.length).toBeGreaterThan(100);
    // Verify output is sorted and disjoint
    for (let i = 1; i < out.length; i++) {
      expect(out[i][0]).toBeGreaterThanOrEqual(out[i - 1][1]);
    }
  });

  test('single large span', () => {
    const input = toWasmIntervals([[0, 1000000]]);
    const out = fromWasmIntervals(wasm.disjoint_intervals_obj(input));
    expect(out).toEqual([[0, 1000000]]);
  });
});
