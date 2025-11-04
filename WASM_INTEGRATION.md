# WASM Integration

This project now includes a WebAssembly build of the Rust disjoint-intervals library with TypeScript bindings.

## Building the WASM Module

From the project root:

```bash
wasm-pack build --target bundler --out-dir pkg
```

This compiles the Rust library to WASM and generates TypeScript bindings in the `pkg/` directory.

## API

The WASM module exposes the following function:

### `disjoint_intervals_obj(input: Array<{start: number, end: number}>): Array<{start: number, end: number}>`

Accepts an array of interval objects with `start` and `end` properties (sorted by start), and returns an array of disjoint interval objects.

**Example:**

```typescript
import wasm from './ts/src/wasm/index.js';

const input = [
  { start: 0, end: 5 },
  { start: 3, end: 8 },
  { start: 10, end: 15 },
];

const disjoint = wasm.disjoint_intervals_obj(input);
// Result: [
//   { start: 0, end: 3 },
//   { start: 3, end: 5 },
//   { start: 5, end: 8 },
//   { start: 10, end: 15 }
// ]
```

## Running the Example

From the `ts/` directory:

```bash
node --experimental-wasm-modules ./src/wasm/example.ts
```

## Running Benchmarks

The TypeScript project includes benchmarks comparing the pure TypeScript and WASM implementations:

```bash
cd ts
npm run bench
```

### Benchmark Results

Preliminary results show comparable performance between TypeScript and WASM implementations:

- **Dense overlapping intervals (10k, width 100)**: ~14-15ms per iteration for both
- **Sparse intervals (10k, gap 200, width 50)**: ~2.3-2.4ms per iteration for both (fastest case)
- **Many same-start intervals (10k)**: ~568-600ms per iteration for both (slowest case)

The WASM implementation has slightly more predictable performance (lower RME), while the TypeScript implementation can be faster in some cases depending on V8 optimizations.

## Integration in TypeScript

The WASM module is integrated into the TypeScript project at `ts/src/wasm/`. The bindings are generated automatically by wasm-pack and re-exported through `ts/src/wasm/index.ts`.

To use WASM in your own code:

```typescript
import wasm from './src/wasm/index.js';

// Your intervals
const intervals = [{ start: 0, end: 10 }, { start: 5, end: 15 }];
const result = wasm.disjoint_intervals_obj(intervals);
```

## Notes

- The WASM module currently uses `u32` for indices, limiting the range to 0..2^32-1
- Empty intervals (start == end) are supported
- Inverted intervals (start > end) will cause an assertion failure
- Input must be sorted by start position
