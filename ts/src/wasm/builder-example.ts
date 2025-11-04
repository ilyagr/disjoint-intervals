import wasm from './index.js';

console.log('=== Builder Pattern API Demo ===\n');
console.log('Note: This library SPLITS intervals at boundaries, it does NOT merge them.');
console.log('Each output interval shows a range where a specific set of inputs overlap.\n');

// Example 1: Building intervals one at a time
console.log('Example 1: Add intervals one at a time');
const builder1 = new wasm.DisjointIntervalsBuilder();

// Simulate receiving intervals from a stream, database query, etc.
const incomingIntervals = [
  { start: 0, end: 5 },
  { start: 3, end: 8 },
  { start: 10, end: 15 },
];

console.log('Adding intervals one at a time:');
for (const interval of incomingIntervals) {
  console.log(`  Adding: [${interval.start}..${interval.end})`);
  builder1.addInterval(interval.start, interval.end);
}

// Build the iterator and start getting results
console.log('\nGetting results (split at every boundary):');
const iter1 = builder1.build();
let result;
let count = 0;
while ((result = iter1.nextInterval()) !== null) {
  console.log(`  ${++count}:`, result);
}
console.log('  ^ Notice how [0..5) and [3..8) are split at boundaries 3 and 5');

// Example 2: Process results as you add intervals (true streaming)
console.log('\nExample 2: Interleaved adding and reading (NOT SUPPORTED)');
console.log('Note: You must add all intervals before calling build()');
console.log('The algorithm requires sorted input to work correctly.');

// Example 3: Performance comparison - building vs array conversion
console.log('\nExample 3: Performance comparison - Builder vs Array');

const testSize = 10000;
const testIntervals = Array.from({ length: testSize }, (_, i) => ({ 
  start: i, 
  end: i + 10 
}));

// Method 1: Builder pattern (add one at a time)
console.time('Builder pattern (add one-by-one)');
const builder2 = new wasm.DisjointIntervalsBuilder();
for (const { start, end } of testIntervals) {
  builder2.addInterval(start, end);
}
const iter2 = builder2.build();
const result2 = iter2.collect();
console.timeEnd('Builder pattern (add one-by-one)');
console.log(`Result length: ${result2.length}`);

// Method 2: Array conversion (pass all at once)
console.time('Array conversion (pass all at once)');
const iter3 = new wasm.DisjointIntervalsIterator(testIntervals);
const result3 = iter3.collect();
console.timeEnd('Array conversion (pass all at once)');
console.log(`Result length: ${result3.length}`);

// Method 3: Non-streaming API
console.time('Non-streaming API');
const result4 = wasm.disjoint_intervals_obj(testIntervals);
console.timeEnd('Non-streaming API');
console.log(`Result length: ${result4.length}`);

// Example 4: Memory efficiency - only process first N results
console.log('\nExample 4: Early termination with builder');
const builder3 = new wasm.DisjointIntervalsBuilder();

// Add many intervals
for (let i = 0; i < 100; i++) {
  builder3.addInterval(i, i + 5);
}

// But only get the first 3 results
const iter4 = builder3.build();
console.log('First 3 results only:');
console.log('  1:', iter4.nextInterval());
console.log('  2:', iter4.nextInterval());
console.log('  3:', iter4.nextInterval());
console.log('(Remaining ~100+ results not computed/converted)');

// Example 5: Practical use case - processing intervals from a generator
console.log('\nExample 5: Using builder with a generator function');

function* generateIntervals(count: number) {
  for (let i = 0; i < count; i++) {
    yield { start: i * 2, end: i * 2 + 3 };
  }
}

const builder4 = new wasm.DisjointIntervalsBuilder();
console.log('Adding intervals from generator:');
let added = 0;
for (const { start, end } of generateIntervals(5)) {
  builder4.addInterval(start, end);
  console.log(`  Added [${start}..${end})`);
  added++;
}

console.log(`\nProcessing ${added} intervals:`);
const iter5 = builder4.build();
const results5 = iter5.collect();
console.log('Results (split at overlaps):', results5);
console.log('  ^ These 9 segments show where 1, 2, or 1 input intervals overlap');

console.log('\n=== Summary ===');
console.log('✅ Builder pattern allows truly streaming input (add intervals one at a time)');
console.log('✅ No upfront array conversion overhead');
console.log('✅ Works great with generators, async iterators, database cursors, etc.');
console.log('⚠️  Intervals must be added in sorted order (by start point)');
console.log('⚠️  Must call build() after adding all intervals before getting results');
console.log('📝 Library SPLITS intervals into disjoint segments, not merges them');
