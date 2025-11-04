import { SplitIntoDisjointRanges, Range, numberOps, type Interval } from '../index.js';

const r = (start: number, end: number) => new Range<number>(start, end, numberOps.show);

function genDense(n: number, width: number): Array<Interval<number, number>> {
  const out: Array<Interval<number, number>> = new Array(n);
  for (let i = 0; i < n; i++) out[i] = [r(i, i + width), i];
  return out;
}

function genSparse(n: number, gap: number, width: number): Array<Interval<number, number>> {
  const out: Array<Interval<number, number>> = new Array(n);
  for (let i = 0; i < n; i++) {
    const s = i * (gap + width);
    out[i] = [r(s, s + width), i];
  }
  return out;
}

function genSameStart(m: number, start: number, includeEmpty: boolean): Array<Interval<number, number>> {
  const out: Array<Interval<number, number>> = [];
  if (includeEmpty) out.push([r(start, start), 0]);
  for (let i = 1; i <= m; i++) out.push([r(start, start + i), i]);
  return out;
}

function measureMemory(name: string, input: Array<Interval<number, number>>) {
  if (global.gc) {
    global.gc();
  }
  
  const memBefore = process.memoryUsage();
  
  const inputClone = input.slice();
  const out = Array.from(SplitIntoDisjointRanges.fromSortedIntervals(inputClone));
  
  const memAfter = process.memoryUsage();
  
  const heapDiff = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
  
  console.log(`${name}:`);
  console.log(`  Input intervals: ${input.length}`);
  console.log(`  Output segments: ${out.length}`);
  console.log(`  Heap delta: ${heapDiff.toFixed(2)} MB`);
  console.log(`  Per input interval: ${((heapDiff * 1024) / input.length).toFixed(2)} KB`);
  console.log();
}

console.log('TypeScript Memory Usage Analysis');
console.log('='.repeat(50));
console.log();

const dense = genDense(10_000, 100);
const sparse = genSparse(10_000, 200, 50);
const sameStart = genSameStart(10_000, 1_000_000, true);

measureMemory('disjoint_dense_10k_w100', dense);
measureMemory('disjoint_sparse_10k_gap200_w50', sparse);
measureMemory('disjoint_many_same_start_10k', sameStart);
