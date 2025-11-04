AI-generated README, intended to point people to where the tests for each
version of the code are.

----


# Disjoint Intervals Library

A library for splitting overlapping labeled intervals into disjoint segments, with implementations in Rust, TypeScript, and WebAssembly.

## Quick Start

### Run Tests

```bash
# Rust tests
cargo test

# TypeScript and WASM tests
cd ts
npm install
npm test
```

### Run Benchmarks

```bash
# Rust benchmarks (Criterion)
cargo bench

# TypeScript and WASM benchmarks (Vitest)
cd ts
npm run bench
```

## Test Locations

- **Rust tests**: [`src/lib.rs`](src/lib.rs) (inline tests, 10 tests)
- **TypeScript tests**: [`ts/src/index.ts`](ts/src/index.ts) (inline tests, 15 tests)
- **WASM functional tests**: [`ts/src/wasm/wasm.test.ts`](ts/src/wasm/wasm.test.ts) (16 tests)
- **WASM parity tests**: [`ts/src/wasm/parity.test.ts`](ts/src/wasm/parity.test.ts) (12 tests comparing WASM vs TS)
- **WASM TypedArray tests**: [`ts/src/wasm/typedarray.test.ts`](ts/src/wasm/typedarray.test.ts) (7 tests)
- **WASM Builder tests**: [`ts/src/wasm/builder.test.ts`](ts/src/wasm/builder.test.ts) (8 tests)

Total: **68 tests** across all implementations

## Benchmark Locations

- **Rust benchmarks**: [`benches/disjoint.rs`](benches/disjoint.rs)
- **TypeScript benchmarks**: [`ts/src/bench/disjoint.bench.ts`](ts/src/bench/disjoint.bench.ts)
- **WASM benchmarks**: [`ts/src/bench/wasm_disjoint.bench.ts`](ts/src/bench/wasm_disjoint.bench.ts)

## Performance Summary

See [`PERFORMANCE_COMPARISON.md`](PERFORMANCE_COMPARISON.md) for detailed results.

**Key findings:**
- **WASM with TypedArray API**: Achieves near-native Rust performance (within 0-10% for most cases)
- **Pure TypeScript**: 4-13× slower than optimized Rust/WASM
- **Using u32 vs usize**: 1.8-2.7× speedup in native Rust

## Documentation

- [`WASM_INTEGRATION.md`](WASM_INTEGRATION.md) - WASM build and API documentation
- [`PERFORMANCE_COMPARISON.md`](PERFORMANCE_COMPARISON.md) - Comprehensive performance comparison
- [`TEST_COVERAGE.md`](TEST_COVERAGE.md) - Detailed test coverage information
- [`BENCHMARK_RESULTS.md`](BENCHMARK_RESULTS.md) - TypeScript vs Rust benchmark results
- [`ts/README.md`](ts/README.md) - TypeScript-specific documentation

## Building WASM

```bash
wasm-pack build --target bundler --out-dir pkg
```