import { describe, test, expect } from 'vitest';
import wasm from './index.js';
import { SplitIntoDisjointRanges, Range, numberOps } from '../index.js';

// Helper to convert intervals to WASM format
function toWasmIntervals(intervals: Array<[number, number]>): Array<{ start: number; end: number }> {
  return intervals.map(([start, end]) => ({ start, end }));
}

// Helper to convert WASM output to comparable format
function fromWasmIntervals(result: any): Array<[number, number]> {
  return Array.from(result).map((obj: any) => [obj.start, obj.end] as [number, number]);
}

// Helper to convert TS intervals to comparable format
function fromTsIntervals(
  result: Iterable<[Range<number>, any]>
): Array<[number, number]> {
  return Array.from(result).map(([range]) => [range.start, range.end] as [number, number]);
}

describe('WASM vs TS parity tests', () => {
  const testCases: Array<{ name: string; input: Array<[number, number]> }> = [
    { name: 'empty', input: [] },
    { name: 'single interval', input: [[0, 5]] },
    { name: 'empty interval', input: [[5, 5]] },
    { name: 'two overlapping', input: [[0, 5], [3, 8]] },
    { name: 'three disjoint', input: [[0, 5], [10, 15], [20, 25]] },
    {
      name: 'many same start',
      input: [[5, 5], [5, 7], [5, 10], [5, 6]],
    },
    {
      name: 'identical endpoints',
      input: [[0, 5], [3, 5], [4, 5], [5, 8]],
    },
    {
      name: 'nested intervals',
      input: [[0, 10], [2, 8], [4, 6]],
    },
    {
      name: 'empty intervals at start points',
      input: [
        [0, 5],
        [4, 6],
        [5, 5],
        [5, 7],
        [7, 7],
        [10, 10],
        [10, 11],
      ],
    },
    {
      name: 'large composite',
      input: [
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
      ],
    },
    {
      name: 'dense overlapping (small)',
      input: Array.from({ length: 20 }, (_, i) => [i, i + 5] as [number, number]),
    },
  ];

  testCases.forEach(({ name, input }) => {
    test(`WASM matches TS: ${name}`, () => {
      // Prepare WASM input
      const wasmInput = toWasmIntervals(input);
      
      // Prepare TS input
      const tsInput = input.map(([start, end]) => [
        new Range(start, end, numberOps.show),
        undefined,
      ] as [Range<number>, undefined]);

      // Get results
      const wasmResult = fromWasmIntervals(wasm.disjoint_intervals_obj(wasmInput));
      const tsResult = fromTsIntervals(SplitIntoDisjointRanges.fromSortedIntervals(tsInput));

      // Compare
      expect(wasmResult).toEqual(tsResult);
    });
  });

  test('WASM matches TS: stress test with 100 intervals', () => {
    const input = Array.from({ length: 100 }, (_, i) => [i, i + 10] as [number, number]);
    
    const wasmInput = toWasmIntervals(input);
    const tsInput = input.map(([start, end]) => [
      new Range(start, end, numberOps.show),
      undefined,
    ] as [Range<number>, undefined]);

    const wasmResult = fromWasmIntervals(wasm.disjoint_intervals_obj(wasmInput));
    const tsResult = fromTsIntervals(SplitIntoDisjointRanges.fromSortedIntervals(tsInput));

    expect(wasmResult).toEqual(tsResult);
  });
});
