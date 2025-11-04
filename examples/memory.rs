use disjoint_intervals_lib::{Interval, SplitIntoDisjointRanges};
use std::mem;

fn gen_dense(n: usize, width: usize) -> Vec<Interval<usize, u32>> {
    (0..n).map(|i| ((i..i + width), i as u32)).collect()
}

fn gen_sparse(n: usize, gap: usize, width: usize) -> Vec<Interval<usize, u32>> {
    (0..n)
        .map(|i| {
            let s = i * (gap + width);
            ((s..s + width), i as u32)
        })
        .collect()
}

fn gen_same_start(m: usize, start: usize, include_empty: bool) -> Vec<Interval<usize, u32>> {
    let mut v: Vec<Interval<usize, u32>> = Vec::with_capacity(m + include_empty as usize);
    if include_empty {
        v.push(((start..start), 0));
    }
    for i in 1..=m {
        v.push(((start..start + i), i as u32));
    }
    v
}

fn measure_memory(name: &str, input: Vec<Interval<usize, u32>>) {
    let input_len = input.len();
    
    // Approximate memory by measuring structure sizes
    let input_bytes = input_len * mem::size_of::<Interval<usize, u32>>();
    
    let out: Vec<_> = SplitIntoDisjointRanges::from_sorted_intervals(input.into_iter()).collect();
    let output_len = out.len();
    
    // Each output is (Range<usize>, Vec<u32>)
    // For "many same start", Vec<u32> grows significantly
    let mut output_bytes = output_len * mem::size_of::<(std::ops::Range<usize>, Vec<u32>)>();
    
    // Add heap allocations for Vec<u32> contents
    for (_, labels) in &out {
        output_bytes += labels.len() * mem::size_of::<u32>();
        output_bytes += labels.capacity() * mem::size_of::<u32>();
    }
    
    let total_mb = (input_bytes + output_bytes) as f64 / 1024.0 / 1024.0;
    
    println!("{}:", name);
    println!("  Input intervals: {}", input_len);
    println!("  Output segments: {}", output_len);
    println!("  Approx total memory: {:.2} MB", total_mb);
    println!("  Per input interval: {:.2} KB", (total_mb * 1024.0) / input_len as f64);
    
    // Show max active labels for "many same start" case
    if let Some(max_labels) = out.iter().map(|(_, labels)| labels.len()).max() {
        println!("  Max labels in one segment: {}", max_labels);
    }
    println!();
}

fn main() {
    println!("Rust Memory Usage Analysis (approximate)");
    println!("{}", "=".repeat(50));
    println!();

    let dense = gen_dense(10_000, 100);
    let sparse = gen_sparse(10_000, 200, 50);
    let same_start = gen_same_start(10_000, 1_000_000, true);

    measure_memory("disjoint_dense_10k_w100", dense);
    measure_memory("disjoint_sparse_10k_gap200_w50", sparse);
    measure_memory("disjoint_many_same_start_10k", same_start);
}
