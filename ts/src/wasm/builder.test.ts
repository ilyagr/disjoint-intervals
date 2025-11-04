import { describe, test, expect } from 'vitest';
import wasm from './index.js';

describe('DisjointIntervalsBuilder', () => {
  test('basic builder usage - add intervals one at a time', () => {
    const builder = new wasm.DisjointIntervalsBuilder();
    
    builder.addInterval(0, 5);
    builder.addInterval(3, 8);
    builder.addInterval(10, 15);
    
    const iter = builder.build();
    const results = iter.collect();
    
    // Splits intervals at boundaries: [0,5) and [3,8) split at 3 and 5
    expect(results).toEqual([
      { start: 0, end: 3 },   // Only [0,5) covers this
      { start: 3, end: 5 },   // Both [0,5) and [3,8) cover this
      { start: 5, end: 8 },   // Only [3,8) covers this
      { start: 10, end: 15 }, // Only [10,15) covers this
    ]);
  });

  test('builder produces same results as array constructor', () => {
    const intervals = [
      { start: 0, end: 5 },
      { start: 3, end: 8 },
      { start: 10, end: 15 },
      { start: 12, end: 20 },
    ];
    
    // Using builder
    const builder = new wasm.DisjointIntervalsBuilder();
    for (const { start, end } of intervals) {
      builder.addInterval(start, end);
    }
    const builderResults = builder.build().collect();
    
    // Using array constructor
    const arrayResults = new wasm.DisjointIntervalsIterator(intervals).collect();
    
    expect(builderResults).toEqual(arrayResults);
  });

  test('builder with early termination', () => {
    const builder = new wasm.DisjointIntervalsBuilder();
    
    // Add many intervals
    for (let i = 0; i < 100; i++) {
      builder.addInterval(i, i + 5);
    }
    
    // Only get first 3 results
    const iter = builder.build();
    const first3 = [
      iter.nextInterval(),
      iter.nextInterval(),
      iter.nextInterval(),
    ];
    
    expect(first3[0]).not.toBeNull();
    expect(first3[1]).not.toBeNull();
    expect(first3[2]).not.toBeNull();
    // Verify we can get more if needed
    expect(iter.nextInterval()).not.toBeNull();
  });

  test('builder with generator function', () => {
    function* generateIntervals(count: number) {
      for (let i = 0; i < count; i++) {
        yield { start: i * 2, end: i * 2 + 3 };
      }
    }
    
    const builder = new wasm.DisjointIntervalsBuilder();
    for (const { start, end } of generateIntervals(5)) {
      builder.addInterval(start, end);
    }
    
    const results = builder.build().collect();
    
    // Intervals: [0..3), [2..5), [4..7), [6..9), [8..11)
    // Split at every boundary: 0,2,3,4,5,6,7,8,9,11
    expect(results).toEqual([
      { start: 0, end: 2 },   // Only [0..3)
      { start: 2, end: 3 },   // [0..3) and [2..5)
      { start: 3, end: 4 },   // Only [2..5)
      { start: 4, end: 5 },   // [2..5) and [4..7)
      { start: 5, end: 6 },   // Only [4..7)
      { start: 6, end: 7 },   // [4..7) and [6..9)
      { start: 7, end: 8 },   // Only [6..9)
      { start: 8, end: 9 },   // [6..9) and [8..11)
      { start: 9, end: 11 },  // Only [8..11)
    ]);
  });

  test('builder with empty input', () => {
    const builder = new wasm.DisjointIntervalsBuilder();
    const results = builder.build().collect();
    
    expect(results).toEqual([]);
  });

  test('builder with single interval', () => {
    const builder = new wasm.DisjointIntervalsBuilder();
    builder.addInterval(5, 10);
    
    const results = builder.build().collect();
    
    expect(results).toEqual([{ start: 5, end: 10 }]);
  });

  test('builder with non-overlapping intervals', () => {
    const builder = new wasm.DisjointIntervalsBuilder();
    builder.addInterval(0, 5);
    builder.addInterval(10, 15);
    builder.addInterval(20, 25);
    
    const results = builder.build().collect();
    
    expect(results).toEqual([
      { start: 0, end: 5 },
      { start: 10, end: 15 },
      { start: 20, end: 25 },
    ]);
  });

  test('builder with completely overlapping intervals', () => {
    const builder = new wasm.DisjointIntervalsBuilder();
    builder.addInterval(0, 20);
    builder.addInterval(5, 10);
    builder.addInterval(12, 15);
    
    const results = builder.build().collect();
    
    // Splits at every boundary: 0,5,10,12,15,20
    expect(results).toEqual([
      { start: 0, end: 5 },   // Only [0..20)
      { start: 5, end: 10 },  // [0..20) and [5..10)
      { start: 10, end: 12 }, // Only [0..20)
      { start: 12, end: 15 }, // [0..20) and [12..15)
      { start: 15, end: 20 }, // Only [0..20)
    ]);
  });
});
