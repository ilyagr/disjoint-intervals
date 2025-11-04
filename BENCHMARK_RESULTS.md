# TypeScript vs Rust Performance Comparison

Benchmarks run on the same machine for comparable dataset sizes.

## Performance (Time)

### TypeScript (Vitest tinybench, Node.js)
| Test Case | Mean Time | Ops/sec |
|-----------|-----------|---------|
| disjoint_dense_10k_w100 | 15.93 ms | 62.8 |
| disjoint_sparse_10k_gap200_w50 | 2.54 ms | 393.5 |
| disjoint_many_same_start_10k | 550.89 ms | 1.82 |

### Rust (Criterion)
| Test Case | Mean Time | Ops/sec |
|-----------|-----------|---------|
| disjoint_dense_10k_w100 | 6.44 ms | 155.3 |
| disjoint_sparse_10k_gap200_w50 | 1.10 ms | 909.1 |
| disjoint_many_same_start_10k | 107.68 ms | 9.29 |

### Slowdown Factor (TS / Rust)
| Test Case | Slowdown |
|-----------|----------|
| disjoint_dense_10k_w100 | **2.5×** |
| disjoint_sparse_10k_gap200_w50 | **2.3×** |
| disjoint_many_same_start_10k | **5.1×** |

## Memory Usage

### TypeScript (Node.js heap delta)
| Test Case | Heap Delta | Per Interval |
|-----------|------------|--------------|
| disjoint_dense_10k_w100 | 18.42 MB | 1.89 KB |
| disjoint_sparse_10k_gap200_w50 | 0.34 MB | 0.03 KB |
| disjoint_many_same_start_10k | 451.36 MB | 46.21 KB |

### Rust (approximate structural size)
| Test Case | Memory | Per Interval |
|-----------|--------|--------------|
| disjoint_dense_10k_w100 | 9.32 MB | 0.95 KB |
| disjoint_sparse_10k_gap200_w50 | 0.80 MB | 0.08 KB |
| disjoint_many_same_start_10k | 475.13 MB | 48.65 KB |

### Memory Overhead (TS / Rust)
| Test Case | Overhead |
|-----------|----------|
| disjoint_dense_10k_w100 | **~2.0×** |
| disjoint_sparse_10k_gap200_w50 | **~0.4×** (TS better!) |
| disjoint_many_same_start_10k | **~0.95×** (comparable) |

## Analysis

### Performance
- TypeScript is **2-2.5× slower** for typical overlapping interval cases
- For pathological "many same start" case, TypeScript is **5× slower**
- Both implementations avoid sorting on every `allLabels()` call by relying on insertion-ordered maps (JS Map / Rust IndexMap)

### Memory
- Memory usage is **comparable** between TypeScript and Rust
- For the sparse case, TypeScript actually uses less memory (likely due to measurement methodology differences)
- For the "many same start" case, both use ~450-475 MB, showing similar memory characteristics
- TypeScript has slightly higher per-interval overhead (1-2×) for dense cases due to object representation

### Key Optimization
The major optimization was removing the O(E log E) sort on every segment in favor of relying on Map's insertion order. This improved the "many same start" case from **12× slower** to **5× slower** compared to Rust.

## Test Datasets

1. **dense_10k_w100**: 10,000 overlapping intervals, each spanning 100 positions
   - Heavy overlap: each position covered by ~100 intervals
   - Produces 10,099 disjoint segments

2. **sparse_10k_gap200_w50**: 10,000 non-overlapping intervals with gaps
   - Width 50, gap 200 between intervals
   - Produces 10,000 segments (one per input)

3. **many_same_start_10k**: 10,000 intervals all starting at position 1,000,000
   - Ends at 1,000,000+1, 1,000,000+2, ..., 1,000,000+10,000
   - Stress test for active set management
   - Produces 10,001 segments (including empty interval at start)
