import { bench, describe } from 'vitest';
import { SplitIntoDisjointRanges, Range, numberOps, type Interval } from '../index.js';

const r = (start: number, end: number) => new Range<number>(start, end, numberOps.show);

function genDense(n: number, width: number): Array<Interval<number, number>> {
  // Overlapping windows: (i..i+width) for i in 0..n-1
  // Already sorted by start.
  const out: Array<Interval<number, number>> = new Array(n);
  for (let i = 0; i < n; i++) out[i] = [r(i, i + width), i];
  return out;
}

function genSparse(n: number, gap: number, width: number): Array<Interval<number, number>> {
  // Non-overlapping windows spaced by gap: (s..s+width)
  // Already sorted by start.
  const out: Array<Interval<number, number>> = new Array(n);
  for (let i = 0; i < n; i++) {
    const s = i * (gap + width);
    out[i] = [r(s, s + width), i];
  }
  return out;
}

function genSameStart(m: number, start: number, includeEmpty: boolean): Array<Interval<number, number>> {
  // Many intervals sharing the same start point with various ends.
  // Optionally include an empty interval at `start..start`.
  const out: Array<Interval<number, number>> = [];
  if (includeEmpty) out.push([r(start, start), 0]);
  for (let i = 1; i <= m; i++) out.push([r(start, start + i), i]);
  return out;
}

// Benchmarks mirroring Rust Criterion cases
const dense = genDense(10_000, 100);
const sparse = genSparse(10_000, 200, 50);
const sameStart = genSameStart(10_000, 1_000_000, true);

describe('disjoint-intervals benches', () => {
  bench('disjoint_dense_10k_w100', () => {
    // Clone input to be closer to Rust's iter_batched clone (small input)
    const input = dense.slice();
    // Consume generator fully
    const out = Array.from(SplitIntoDisjointRanges.fromSortedIntervals(input));
    // Prevent super-aggressive dead code elimination assumptions
    if (out.length === -1) throw new Error('unreachable');
  });

  bench('disjoint_sparse_10k_gap200_w50', () => {
    const input = sparse.slice();
    const out = Array.from(SplitIntoDisjointRanges.fromSortedIntervals(input));
    if (out.length === -1) throw new Error('unreachable');
  });

  bench('disjoint_many_same_start_10k', () => {
    const input = sameStart.slice();
    const out = Array.from(SplitIntoDisjointRanges.fromSortedIntervals(input));
    if (out.length === -1) throw new Error('unreachable');
  });
});
