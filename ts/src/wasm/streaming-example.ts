import wasm from './index.js';

console.log('=== Streaming WASM API Demo ===\n');

// Example 1: Manual iteration
console.log('Example 1: Pull intervals one at a time');
const input1 = [
  { start: 0, end: 5 },
  { start: 3, end: 8 },
  { start: 10, end: 15 },
];

const iter1 = new wasm.DisjointIntervalsIterator(input1);
console.log('Input:', input1);
console.log('Output (streamed):');

let interval;
let count = 0;
while ((interval = iter1.nextInterval()) !== null) {
  console.log(`  ${++count}:`, interval);
}

// Example 2: Collect remaining after processing some
console.log('\nExample 2: Process first few, then collect rest');
const input2 = [
  { start: 0, end: 5 },
  { start: 2, end: 2 },
  { start: 3, end: 8 },
  { start: 8, end: 9 },
  { start: 10, end: 15 },
];

const iter2 = new wasm.DisjointIntervalsIterator(input2);
console.log('Input:', input2);

// Process first 2 intervals manually
console.log('First 2 intervals:');
console.log('  1:', iter2.nextInterval());
console.log('  2:', iter2.nextInterval());

// Collect the rest
console.log('Remaining intervals (collected):');
const remaining = iter2.collect();
console.log(remaining);

// Example 3: Early termination
console.log('\nExample 3: Early termination (only get first interval)');
const input3 = Array.from({ length: 100 }, (_, i) => ({ start: i, end: i + 5 }));

const iter3 = new wasm.DisjointIntervalsIterator(input3);
console.log(`Input: ${input3.length} intervals`);
console.log('First interval only:', iter3.nextInterval());
console.log('(Stopped early - rest of iterator not consumed)');

// Example 4: Comparison with non-streaming API
console.log('\nExample 4: Performance comparison');
const largeInput = Array.from({ length: 10000 }, (_, i) => ({ start: i, end: i + 10 }));

console.time('Streaming API (collect all)');
const iterStreaming = new wasm.DisjointIntervalsIterator(largeInput);
const resultStreaming = iterStreaming.collect();
console.timeEnd('Streaming API (collect all)');
console.log(`Result length: ${resultStreaming.length}`);

console.time('Non-streaming API');
const resultNonStreaming = wasm.disjoint_intervals_obj(largeInput);
console.timeEnd('Non-streaming API');
console.log(`Result length: ${resultNonStreaming.length}`);

console.log('\nNote: Streaming API allows processing results before all input is converted,');
console.log('but the current implementation still converts all input upfront.');
console.log('The real benefit comes from being able to stop early or process incrementally.');
