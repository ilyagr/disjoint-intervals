# Complete Performance Comparison: Rust (native) vs WASM vs TypeScript

Benchmarks comparing the disjoint intervals algorithm across different implementations and data types.

## Test Configuration
- **Dataset size**: 10,000 intervals
- **Rust benchmarks**: Criterion (100 samples, statistical analysis)
- **WASM/TypeScript benchmarks**: Vitest tinybench (Node.js v22.20.0)
- **Machine**: Same machine for all tests

## Results

### Dense Case (10k overlapping intervals, width 100)
Produces ~10,099 disjoint segments. Heavy overlap: each position covered by ~100 intervals.

| Implementation | Time | Relative to Rust u32 | Notes |
|----------------|------|---------------------|-------|
| **Rust usize (with clone)** | 7.01 ms | 2.68× | Original benchmark |
| **Rust usize (no clone)** | 7.09 ms | 2.71× | Clone overhead negligible! |
| **Rust u32 (with clone)** | **2.62 ms** | **1.0× (baseline)** | 2.7× faster with u32 |
| **WASM u32 (with copy)** | 2.78 ms | 1.06× | ~6% slower than native Rust u32 |
| **WASM u32 (no copy)** | 2.68 ms | 1.02× | Matches native Rust u32! |
| **TypeScript** | 12.51 ms | 4.77× | Pure JS implementation |

### Sparse Case (10k non-overlapping, gap 200, width 50)
Produces 10,000 segments (one per input). Minimal overlap.

| Implementation | Time | Relative to Rust u32 | Notes |
|----------------|------|---------------------|-------|
| **Rust usize (with clone)** | 1.24 ms | 1.77× | Original benchmark |
| **Rust usize (no clone)** | 1.24 ms | 1.77× | Clone overhead negligible |
| **Rust u32 (with clone)** | **0.70 ms** | **1.0× (baseline)** | 1.8× faster with u32 |
| **WASM u32 (with copy)** | 0.68 ms | 0.97× | Matches native Rust u32! |
| **WASM u32 (no copy)** | 0.65 ms | 0.93× | Slightly faster than native?! |
| **TypeScript** | 3.32 ms | 4.74× | Pure JS implementation |

### Pathological Case (10k intervals, all same start)
Produces ~10,001 segments. Stress test for active set management.

| Implementation | Time | Relative to Rust u32 | Notes |
|----------------|------|---------------------|-------|
| **Rust usize (with clone)** | 117.2 ms | 2.08× | Original benchmark |
| **Rust usize (no clone)** | 117.5 ms | 2.08× | Clone overhead negligible |
| **Rust u32 (with clone)** | **56.4 ms** | **1.0× (baseline)** | 2.1× faster with u32 |
| **WASM u32 (with copy)** | 86.6 ms | 1.54× | 50% slower than native |
| **WASM u32 (no copy)** | 86.3 ms | 1.53× | 50% slower than native |
| **TypeScript** | 736 ms | 13.05× | Pure JS implementation |

## Key Findings

### 1. Data Type Matters Significantly
Using `u32` instead of `usize` (64-bit) provides **1.8-2.7× speedup** in native Rust:
- **Better cache usage**: Half the memory per value (4 bytes vs 8 bytes)
- **Faster comparisons**: 32-bit operations vs 64-bit
- **Less memory bandwidth**: Reduced data movement

### 2. Clone Overhead is Negligible
The `data.clone()` in benchmarks adds virtually no time - the algorithm itself dominates.
This means the Rust `iter_batched` setup cost is minimal.

### 3. WASM Achieves Near-Native Performance
When using TypedArrays with `u32`, WASM performance is **within 0-10%** of native Rust for most cases:
- ✅ **Dense case**: Essentially identical (2% difference)
- ✅ **Sparse case**: Actually slightly faster (possibly V8 optimizations)
- ⚠️ **Pathological case**: ~50% slower (likely different allocator behavior under memory stress)

The TypedArray API eliminates JS/WASM boundary overhead completely.

### 4. TypeScript Performance
Pure TypeScript implementation using the same algorithm is consistently **4-13× slower**:
- **Dense/Sparse**: ~4.7× slower (acceptable for many use cases)
- **Pathological**: ~13× slower (algorithm complexity dominates)

### 5. Object API Overhead (for reference)
The original WASM Object API (using Reflect::get/set) was **5-25× slower** than native Rust.
The TypedArray API reduces this overhead from 5-25× to just 0-10%.

## Recommendations

1. **Use TypedArray API for performance-critical code**: Provides near-native Rust performance
2. **Use Object API for convenience**: Better developer experience, acceptable for non-critical paths
3. **Pure TypeScript is viable**: Only 4-5× slower for typical cases, with simpler deployment
4. **Consider u32 for Rust implementations**: Significant speedup if 32-bit indices are sufficient

## Implementation Details

### Rust u32 benchmark
```rust
fn gen_dense_u32(n: u32, width: u32) -> Vec<Interval<u32, ()>> {
    (0..n).map(|i| ((i..i + width), ())).collect()
}
```

### WASM TypedArray API
```rust
#[wasm_bindgen]
pub fn disjoint_intervals_u32(input: &[u32]) -> Vec<u32> {
    // Input: [start0, end0, start1, end1, ...]
    // Output: [start0, end0, start1, end1, ...]
}
```

### TypeScript usage
```typescript
const input = new Uint32Array([0, 5, 3, 8, 10, 15]);
const result = wasm.disjoint_intervals_u32(input);
// result: Uint32Array [0, 3, 3, 5, 5, 8, 10, 15]
```
