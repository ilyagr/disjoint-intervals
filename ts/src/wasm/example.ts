import wasm from './index.js';

async function run() {
  // Test the add function
  const addResult = wasm.add(2, 3);
  console.log('WASM add(2, 3) =', addResult);

  // Test disjoint_intervals_obj with a simple example
  const input = [
    { start: 0, end: 5 },
    { start: 3, end: 8 },
    { start: 10, end: 15 },
  ];
  
  console.log('\nInput intervals:', input);
  const result = wasm.disjoint_intervals_obj(input);
  console.log('Disjoint intervals:', result);
  
  // More complex example with overlapping intervals
  const complex = [
    { start: 0, end: 5 },
    { start: 2, end: 2 },  // empty interval
    { start: 3, end: 8 },
    { start: 8, end: 9 },
  ];
  
  console.log('\nComplex input:', complex);
  const complexResult = wasm.disjoint_intervals_obj(complex);
  console.log('Complex disjoint intervals:', complexResult);
}

run();
