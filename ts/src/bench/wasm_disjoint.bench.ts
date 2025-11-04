import { bench, describe } from 'vitest';
import wasm from '../wasm/index.js';
import { genDense, genSparse, genSameStart } from './disjoint.bench.js';

// Convert TS intervals (with Range objects) to plain objects for WASM
function intervalsToObjects(intervals: Array<[any, any]>): Array<{ start: number; end: number }> {
  return intervals.map(([range, _label]) => ({ start: range.start, end: range.end }));
}

const dense = genDense(10_000, 100);
const sparse = genSparse(10_000, 200, 50);
const sameStart = genSameStart(10_000, 1_000_000, true);

describe('wasm disjoint-intervals benches', () => {
  bench('wasm_disjoint_dense_10k_w100', () => {
    const input = intervalsToObjects(dense.slice());
    const out = wasm.disjoint_intervals_obj(input);
    if (out.length === -1) throw new Error('unreachable');
  });

  bench('wasm_disjoint_sparse_10k_gap200_w50', () => {
    const input = intervalsToObjects(sparse.slice());
    const out = wasm.disjoint_intervals_obj(input);
    if (out.length === -1) throw new Error('unreachable');
  });

  bench('wasm_disjoint_many_same_start_10k', () => {
    const input = intervalsToObjects(sameStart.slice());
    const out = wasm.disjoint_intervals_obj(input);
    if (out.length === -1) throw new Error('unreachable');
  });
});
