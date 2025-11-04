import { SplitIntoDisjointRanges, Range, numberOps, type Interval } from '../index.js';

const r = (start: number, end: number) => new Range<number>(start, end, numberOps.show);

// Generate just 100 intervals for easier analysis
const input: Array<Interval<number, number>> = [];
input.push([r(5, 5), 0]);
for (let i = 1; i <= 100; i++) {
  input.push([r(5, 5 + i), i]);
}

const out = Array.from(SplitIntoDisjointRanges.fromSortedIntervals(input));

console.log('Total segments:', out.length);
console.log('\nFirst 5 segments:');
for (let i = 0; i < 5; i++) {
  const [range, labels] = out[i];
  console.log(`  Segment ${i}: range=${range}, labels.length=${labels.length}`);
}

console.log('\nLast 5 segments:');
for (let i = out.length - 5; i < out.length; i++) {
  const [range, labels] = out[i];
  console.log(`  Segment ${i}: range=${range}, labels.length=${labels.length}`);
}

// Calculate total labels across all segments
const totalLabels = out.reduce((sum, [, labels]) => sum + labels.length, 0);
console.log('\nTotal label references across all segments:', totalLabels);
console.log('Input intervals:', input.length);
console.log('Ratio (total labels / input):', (totalLabels / input.length).toFixed(1) + 'x');

console.log('\n--- For 10k case extrapolation ---');
const n = 10000;
// Sum of 1 + 2 + 3 + ... + n = n(n+1)/2
const expectedTotalLabels = (n * (n + 1)) / 2;
console.log(`Expected total labels for ${n} intervals: ${expectedTotalLabels.toLocaleString()}`);
console.log(`That's ${(expectedTotalLabels / n).toFixed(1)}x the input size`);

console.log('\n--- Memory breakdown ---');
// Each number label in JS is stored in an array
// V8 uses SMI (small integers) for numbers that fit in 31 bits, which is very efficient
// But still, array overhead + pointers add up
console.log('50 million label references stored in 10k arrays');
console.log('This is the FUNDAMENTAL cost of the algorithm for this pathological case:');
console.log('  - First segment needs ALL 10k labels active');
console.log('  - Second segment needs 9,999 labels');
console.log('  - etc...');
console.log('\nEstimated memory per label reference (in array): ~8-10 bytes');
console.log(`  -> ${expectedTotalLabels.toLocaleString()} labels × 8 bytes = ${(expectedTotalLabels * 8 / 1024 / 1024).toFixed(2)} MB`);
console.log(`  -> ${expectedTotalLabels.toLocaleString()} labels × 10 bytes = ${(expectedTotalLabels * 10 / 1024 / 1024).toFixed(2)} MB`);
console.log('\nPlus array overhead, Range objects for the segments, etc.');
console.log('Total observed: ~450 MB (TS) and ~475 MB (Rust) - both comparable!');
