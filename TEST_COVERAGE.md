# Test Coverage Summary

## Overview

The disjoint-intervals library has comprehensive test coverage across all three implementations:
- **Rust**: 10 tests (all passing)
- **TypeScript**: 15 tests (all passing)
- **WASM**: 28 tests (all passing)

Total: **53 tests across all implementations**

## Test Categories

### 1. Basic Functionality Tests
- Empty input handling
- Single interval processing
- Empty intervals (start == end)

### 2. Edge Case Tests
- Multiple intervals with identical start points
- Multiple intervals with identical end points
- Empty intervals at various positions
- Overlapping vs non-overlapping intervals
- Nested intervals

### 3. Error Handling Tests
- Unsorted input detection (must panic/throw)
- Inverted intervals (start > end) detection (must panic/throw)

### 4. Complex Scenarios
- Large composite examples with many overlaps
- Multiple annotation types (syntax highlighting + diffs)
- Tuple-based indices (lexicographic ordering)

### 5. Stress Tests
- 100+ overlapping intervals
- Large span intervals (0..1,000,000)
- Dense overlapping patterns

### 6. Cross-Implementation Parity Tests
- 12 dedicated tests comparing WASM vs TypeScript output
- All tests confirm **identical behavior** across implementations

## Test Results

### Rust Tests
```
running 10 tests
test tests::test_active_next_end_and_is_empty ... ok
test tests::test_active_forget_removes_all_at_or_before ... ok
test tests::test_active_all_labels_order_agnostic ... ok
test tests::test_active_add_inverted_interval_panics - should panic ... ok
test tests::test_inverted_interval_panics - should panic ... ok
test tests::test_unsorted_input_panics - should panic ... ok
test tests::test_identical_end_points_drop_all ... ok
test tests::test_many_same_start_including_empties ... ok
test tests::test_mutliple_annotations ... ok
test tests::test_algorithm ... ok

test result: ok. 10 passed; 0 failed; 0 ignored
```

### TypeScript Tests
```
✓ src/index.ts (15 tests)
  ✓ SplitIntoDisjointRanges basic (3)
  ✓ Edge behaviors (4)
  ✓ Parity with Rust tests (2)
  ✓ ActiveIntervalsOrderedByEndpoint behavior (4)
  ✓ Multiple annotations with k-merge (1)
  ✓ Tuple index support (1)

test result: ok. 15 passed; 0 failed
```

### WASM Tests
```
✓ src/wasm/wasm.test.ts (16 tests)
  ✓ WASM SplitIntoDisjointRanges basic (3)
  ✓ WASM Edge behaviors (4)
  ✓ WASM Parity with Rust tests (2)
  ✓ WASM Additional test cases (5)
  ✓ WASM Stress tests (2)

✓ src/wasm/parity.test.ts (12 tests)
  ✓ WASM vs TS parity tests (12)
    - Validates identical output for all test cases

test result: ok. 28 passed; 0 failed
```

## Running Tests

### Run all TypeScript and WASM tests:
```bash
cd ts
npm test
```

### Run Rust tests:
```bash
cargo test
```

### Run benchmarks:
```bash
# TypeScript benchmarks
cd ts
npm run bench

# Rust benchmarks
cargo bench
```

## Test File Locations

- Rust tests: `src/lib.rs` (inline with implementation)
- TypeScript tests: `ts/src/index.ts` (inline with implementation)
- WASM functional tests: `ts/src/wasm/wasm.test.ts`
- WASM parity tests: `ts/src/wasm/parity.test.ts`
- Benchmarks (TS): `ts/src/bench/disjoint.bench.ts`
- Benchmarks (WASM): `ts/src/bench/wasm_disjoint.bench.ts`
- Benchmarks (Rust): `benches/disjoint.rs`

## Continuous Integration

All tests should be run as part of CI/CD:
```bash
# Full test suite
cargo test && cd ts && npm test
```
