use criterion::{BatchSize, Criterion, black_box, criterion_group, criterion_main};
use disjoint_intervals_lib::{Interval, SplitIntoDisjointRanges};

fn gen_dense(n: usize, width: usize) -> Vec<Interval<usize, u32>> {
    // Overlapping windows: (i..i+width) for i in 0..n
    // Already sorted by start.
    (0..n).map(|i| ((i..i + width), i as u32)).collect()
}

fn gen_sparse(n: usize, gap: usize, width: usize) -> Vec<Interval<usize, u32>> {
    // Non-overlapping windows spaced by gap: (s..s+width)
    // Already sorted by start.
    (0..n)
        .map(|i| {
            let s = i * (gap + width);
            ((s..s + width), i as u32)
        })
        .collect()
}

fn gen_same_start(m: usize, start: usize, include_empty: bool) -> Vec<Interval<usize, u32>> {
    // Many intervals sharing the same start point with various ends.
    // Optionally include an empty interval at `start..start`.
    let mut v: Vec<Interval<usize, u32>> = Vec::with_capacity(m + include_empty as usize);
    if include_empty {
        v.push(((start..start), 0));
    }
    for i in 1..=m {
        v.push(((start..start + i), i as u32));
    }
    v
}

fn bench_dense(c: &mut Criterion) {
    let data = gen_dense(10_000, 100);
    c.bench_function("disjoint_dense_10k_w100", |b| {
        b.iter_batched(
            || data.clone(),
            |d| {
                let out: Vec<_> =
                    SplitIntoDisjointRanges::from_sorted_intervals(d.into_iter()).collect();
                black_box(out);
            },
            BatchSize::SmallInput,
        )
    });
}

fn bench_sparse(c: &mut Criterion) {
    let data = gen_sparse(10_000, 200, 50);
    c.bench_function("disjoint_sparse_10k_gap200_w50", |b| {
        b.iter_batched(
            || data.clone(),
            |d| {
                let out: Vec<_> =
                    SplitIntoDisjointRanges::from_sorted_intervals(d.into_iter()).collect();
                black_box(out);
            },
            BatchSize::SmallInput,
        )
    });
}

fn bench_same_start(c: &mut Criterion) {
    let data = gen_same_start(10_000, 1_000_000, true);
    c.bench_function("disjoint_many_same_start_10k", |b| {
        b.iter_batched(
            || data.clone(),
            |d| {
                let out: Vec<_> =
                    SplitIntoDisjointRanges::from_sorted_intervals(d.into_iter()).collect();
                black_box(out);
            },
            BatchSize::SmallInput,
        )
    });
}

criterion_group!(benches, bench_dense, bench_sparse, bench_same_start);
criterion_main!(benches);
