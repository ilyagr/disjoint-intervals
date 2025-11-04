import { bench, describe } from 'vitest';
import wasm from '../wasm/index.js';
import { genDense, genSparse, genSameStart } from './disjoint.bench.js';

// Convert TS intervals (with Range objects) to plain objects for WASM
function intervalsToObjects(intervals: Array<[any, any]>): Array<{ start: number; end: number }> {
  return intervals.map(([range, _label]) => ({ start: range.start, end: range.end }));
}

// Convert TS intervals to TypedArray format [start0, end0, start1, end1, ...]
function intervalsToTypedArray(intervals: Array<[any, any]>): Uint32Array {
  const flat = new Uint32Array(intervals.length * 2);
  for (let i = 0; i < intervals.length; i++) {
    flat[i * 2] = intervals[i][0].start;
    flat[i * 2 + 1] = intervals[i][0].end;
  }
  return flat;
}

const dense = genDense(10_000, 100);
const sparse = genSparse(10_000, 200, 50);
const sameStart = genSameStart(10_000, 1_000_000, true);

// Pre-convert to TypedArrays for fair comparison (like Rust's iter_batched setup)
const denseTyped = intervalsToTypedArray(dense);
const sparseTyped = intervalsToTypedArray(sparse);
const sameStartTyped = intervalsToTypedArray(sameStart);

describe('wasm disjoint-intervals benches (Object API)', () => {
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

describe('wasm disjoint-intervals benches (TypedArray API)', () => {
  bench('wasm_u32_disjoint_dense_10k_w100', () => {
    // Slice to copy the array (like Rust's clone)
    const input = denseTyped.slice();
    const out = wasm.disjoint_intervals_u32(input);
    if (out.length === 0 && dense.length > 0) throw new Error('unreachable');
  });

  bench('wasm_u32_disjoint_sparse_10k_gap200_w50', () => {
    const input = sparseTyped.slice();
    const out = wasm.disjoint_intervals_u32(input);
    if (out.length === 0 && sparse.length > 0) throw new Error('unreachable');
  });

  bench('wasm_u32_disjoint_many_same_start_10k', () => {
    const input = sameStartTyped.slice();
    const out = wasm.disjoint_intervals_u32(input);
    if (out.length === 0 && sameStart.length > 0) throw new Error('unreachable');
  });
});

describe('wasm disjoint-intervals benches (TypedArray API - no copy)', () => {
  bench('wasm_u32_nocopy_disjoint_dense_10k_w100', () => {
    // Don't copy - pass the same buffer each time (WASM will copy internally)
    const out = wasm.disjoint_intervals_u32(denseTyped);
    if (out.length === 0 && dense.length > 0) throw new Error('unreachable');
  });

  bench('wasm_u32_nocopy_disjoint_sparse_10k_gap200_w50', () => {
    const out = wasm.disjoint_intervals_u32(sparseTyped);
    if (out.length === 0 && sparse.length > 0) throw new Error('unreachable');
  });

  bench('wasm_u32_nocopy_disjoint_many_same_start_10k', () => {
    const out = wasm.disjoint_intervals_u32(sameStartTyped);
    if (out.length === 0 && sameStart.length > 0) throw new Error('unreachable');
  });
});
