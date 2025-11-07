import { Heap } from 'heap-js';

// ---- Generic index support ----
export type Comparator<Ix> = (a: Ix, b: Ix) => number;
export type KeyFn<Ix> = (ix: Ix) => string;
export type ShowFn<Ix> = (ix: Ix) => string;

export interface IxOps<Ix> {
  compare: Comparator<Ix>;
  keyOf: KeyFn<Ix>;
  show: ShowFn<Ix>;
}

export const numberOps: IxOps<number> = {
  compare: (a, b) => a - b,
  keyOf: (ix) => String(ix),
  show: (ix) => String(ix),
};

export const tuple2NumberOps: IxOps<[number, number]> = {
  compare: (a, b) => (a[0] - b[0]) || (a[1] - b[1]),
  keyOf: (ix) => `${ix[0]}:${ix[1]}`,
  show: (ix) => `(${ix[0]},${ix[1]})`,
};

export class Range<Ix> {
  constructor(public start: Ix, public end: Ix, private showIx: ShowFn<Ix>) {}
  toString(): string {
    return `${this.showIx(this.start)}..${this.showIx(this.end)}`;
  }
  toJSON(): string {
    // Make snapshots render ranges as a concise string
    return this.toString();
  }
}

export type Interval<Ix, Label> = [Range<Ix>, Label];

export const startPointBefore = <Ix, Label>(ops: IxOps<Ix>) =>
  (a: Interval<Ix, Label>, b: Interval<Ix, Label>): boolean => ops.compare(a[0].start, b[0].start) < 0;

// ---- K-way merge utilities ----

/**
 * Merge multiple sorted lists of intervals into a single sorted list.
 * Uses a k-way merge algorithm with a min-heap for efficiency.
 * 
 * @param lists - Array of sorted interval lists to merge
 * @param less - Comparison function that returns true if first interval should come before second
 * @returns A single merged sorted list
 * 
 * @example
 * ```typescript
 * const list1 = [[r(0, 3), 'a'], [r(5, 8), 'b']];
 * const list2 = [[r(2, 4), 'c'], [r(6, 9), 'd']];
 * const merged = kmergeBy([list1, list2], startPointBefore(numberOps));
 * ```
 */
export function kmergeBy<Ix, L>(
  lists: Array<Array<Interval<Ix, L>>>,
  less: (a: Interval<Ix, L>, b: Interval<Ix, L>) => boolean,
): Array<Interval<Ix, L>> {
  type Node = { value: Interval<Ix, L>; idx: number; list: number };
  
  // Min-heap that uses the comparison function, breaking ties by list index for stability
  const heap = new Heap<Node>((a, b) => 
    less(a.value, b.value) ? -1 : 
    less(b.value, a.value) ? 1 : 
    a.list - b.list
  );
  
  // Initialize heap with the first element from each non-empty list
  for (let li = 0; li < lists.length; li++) {
    if (lists[li].length > 0) {
      heap.push({ value: lists[li][0], idx: 0, list: li });
    }
  }
  
  const out: Array<Interval<Ix, L>> = [];
  
  // Extract minimum element and add next element from same list
  while (!heap.isEmpty()) {
    const { value, idx, list } = heap.pop()!;
    out.push(value);
    
    const nextIdx = idx + 1;
    if (nextIdx < lists[list].length) {
      heap.push({ value: lists[list][nextIdx], idx: nextIdx, list });
    }
  }
  
  return out;
}

/**
 * Merge multiple sorted lists of intervals by their start points.
 * Convenience wrapper around kmergeBy using startPointBefore.
 * 
 * @param lists - Array of sorted interval lists to merge (sorted by start point)
 * @param ops - Index operations for comparison (defaults to numberOps)
 * @returns A single merged sorted list
 * 
 * @example
 * ```typescript
 * const list1 = [[r(0, 3), 'a'], [r(5, 8), 'b']];
 * const list2 = [[r(2, 4), 'c'], [r(6, 9), 'd']];
 * const merged = kmerge([list1, list2]);
 * // Result: [[r(0,3),'a'], [r(2,4),'c'], [r(5,8),'b'], [r(6,9),'d']]
 * ```
 */
export function kmerge<Ix, L>(
  lists: Array<Array<Interval<Ix, L>>>,
  ops: IxOps<Ix> = numberOps as unknown as IxOps<Ix>,
): Array<Interval<Ix, L>> {
  return kmergeBy(lists, startPointBefore<Ix, L>(ops));
}

export class ActiveIntervalsOrderedByEndpoint<Ix, Label> {
  private heap: Heap<Ix>;
  // Map maintains insertion order (like Rust's IndexMap). Since we only insert
  // new endpoints in heap order (ascending), iteration order = ascending endpoint order.
  private map: Map<string, { ix: Ix; intervals: Array<Interval<Ix, Label>> }>;

  constructor(private ops: IxOps<Ix>) {
    // Min-heap over end points using provided comparator
    this.heap = new Heap<Ix>(this.ops.compare);
    this.map = new Map();
  }

  isEmpty(): boolean {
    return this.map.size === 0;
  }

  add(interval: Interval<Ix, Label>): void {
    const [{ start, end }] = interval;
    if (this.ops.compare(start, end) > 0) throw new Error('Interval start must be <= end');

    const endKey = this.ops.keyOf(end);
    const bucket = this.map.get(endKey);
    if (!bucket) {
      this.map.set(endKey, { ix: end, intervals: [interval] });
      this.heap.push(end);
    } else {
      bucket.intervals.push(interval);
    }
  }

  nextEnd(): Ix | undefined {
    return this.heap.peek();
  }

  forgetIntervalsEndingAtOrBefore(position: Ix): void {
    while (this.heap.peek() !== undefined && this.ops.compare(this.heap.peek() as Ix, position) <= 0) {
      const end = this.heap.pop();
      if (end === undefined) break;
      this.map.delete(this.ops.keyOf(end));
    }
  }

  allLabels(): Label[] {
    // Map iteration order = insertion order = ascending endpoint order
    // (because we only insert new endpoints in heap-pop order, which is ascending)
    const out: Label[] = [];
    for (const bucket of this.map.values()) {
      for (const [, label] of bucket.intervals) out.push(label);
    }
    return out;
  }
}

export class SplitIntoDisjointRanges<Ix, Label> implements Iterable<Interval<Ix, Label[]>> {
  private iter: Iterator<Interval<Ix, Label>>;
  private lookahead: IteratorResult<Interval<Ix, Label>> | null = null;
  private position: Ix | undefined = undefined;
  private active: ActiveIntervalsOrderedByEndpoint<Ix, Label>;

  private constructor(sortedIntervals: Iterable<Interval<Ix, Label>>, private ops: IxOps<Ix>) {
    this.iter = sortedIntervals[Symbol.iterator]();
    this.active = new ActiveIntervalsOrderedByEndpoint<Ix, Label>(ops);
  }

  static fromSortedIntervals<Ix, Label>(
    sortedIntervals: Iterable<Interval<Ix, Label>>,
    ops: IxOps<Ix> = numberOps as unknown as IxOps<Ix>,
  ): SplitIntoDisjointRanges<Ix, Label> {
    return new SplitIntoDisjointRanges(sortedIntervals, ops);
  }

  private peek(): Interval<Ix, Label> | undefined {
    if (this.lookahead === null) this.lookahead = this.iter.next();
    return this.lookahead.done ? undefined : this.lookahead.value;
  }

  private next(): Interval<Ix, Label> | undefined {
    const v = this.peek();
    this.lookahead = null;
    return v;
  }

  [Symbol.iterator](): Iterator<Interval<Ix, Label[]>> {
    const self = this;
    return (function* () {
      while (true) {
        let thisIntervalStart: Ix;

        // Establish start position and admit all intervals at that start
        while (true) {
          if (self.position === undefined) {
            const p = self.peek();
            if (!p) return; // no input at all
            self.position = p[0].start;
          }
          thisIntervalStart = self.position as Ix;

          // Admit all intervals starting at this position
          while (true) {
            const nxt = self.peek();
            if (!nxt) break;
            const start = nxt[0].start;
            if (self.ops.compare(start, thisIntervalStart) < 0)
              throw new Error('Input intervals were not properly sorted');
            if (self.ops.compare(start, thisIntervalStart) !== 0) break;
            // starts exactly at position, admit it
            const got = self.next()!;
            self.active.add(got);
          }

          if (self.active.isEmpty()) {
            // nothing active yet, move position to next start (if any), and loop
            const nxt = self.peek();
            if (!nxt) return; // completely done
            const nextStart = nxt[0].start;
            if (self.ops.compare(nextStart, thisIntervalStart) < 0)
              throw new Error('Input intervals were not properly sorted');
            self.position = nextStart;
            continue; // establish and admit at the new start
          }

          break; // we have active intervals
        }

        const nextRangeStart = (() => {
          const nxt = self.peek();
          return nxt ? nxt[0].start : undefined;
        })();

        const nextActiveEnd = self.active.nextEnd();
        if (nextActiveEnd === undefined) return;

        let stopAt = nextActiveEnd as Ix;
        if (nextRangeStart !== undefined && self.ops.compare(nextRangeStart, stopAt) < 0) stopAt = nextRangeStart;

        const labels = self.active.allLabels();
        const result: Interval<Ix, Label[]> = [new Range(thisIntervalStart, stopAt, self.ops.show), labels];
        yield result;

        self.active.forgetIntervalsEndingAtOrBefore(stopAt);
        self.position = stopAt;
      }
    })();
  }
}

// ----------------- In-source tests -----------------
if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest;

  const r = (start: number, end: number) => new Range<number>(start, end, numberOps.show);
  const i = (start: number, end: number): Interval<number, Range<number>> => [r(start, end), r(start, end)];

  function collect<Ix, Label>(iterable: Iterable<Interval<Ix, Label>>): Array<Interval<Ix, Label>> {
    return Array.from(iterable);
  }

  describe('SplitIntoDisjointRanges basic', () => {
    test('empty input', () => {
      const input: Array<Interval<number, never>> = [];
      const out = collect(SplitIntoDisjointRanges.fromSortedIntervals(input));
      expect(out).toMatchInlineSnapshot(`[]`);
    });

    test('single non-empty interval', () => {
      const input = [i(0, 5)];
      const out = collect(SplitIntoDisjointRanges.fromSortedIntervals(input));
      expect(out).toMatchInlineSnapshot(`
        [
          [
            "0..5",
            [
              "0..5",
            ],
          ],
        ]
      `);
    });

    test('single empty interval becomes 0-length segment', () => {
      const input = [i(5, 5)];
      const out = collect(SplitIntoDisjointRanges.fromSortedIntervals(input));
      expect(out).toMatchInlineSnapshot(`
        [
          [
            "5..5",
            [
              "5..5",
            ],
          ],
        ]
      `);
    });
  });

  describe('Edge behaviors', () => {
    test('many same start including empties', () => {
      const input = [i(5, 5), i(5, 7), i(5, 10), i(5, 6)];
      const out = collect(SplitIntoDisjointRanges.fromSortedIntervals(input));
      expect(out).toMatchInlineSnapshot(`
        [
          [
            "5..5",
            [
              "5..5",
              "5..7",
              "5..10",
              "5..6",
            ],
          ],
          [
            "5..6",
            [
              "5..7",
              "5..10",
              "5..6",
            ],
          ],
          [
            "6..7",
            [
              "5..7",
              "5..10",
            ],
          ],
          [
            "7..10",
            [
              "5..10",
            ],
          ],
        ]
      `);
    });

    test('identical end points drop all at boundary', () => {
      const input = [i(0, 5), i(3, 5), i(4, 5), i(5, 8)];
      const out = collect(SplitIntoDisjointRanges.fromSortedIntervals(input));
      expect(out).toMatchInlineSnapshot(`
        [
          [
            "0..3",
            [
              "0..5",
            ],
          ],
          [
            "3..4",
            [
              "0..5",
              "3..5",
            ],
          ],
          [
            "4..5",
            [
              "0..5",
              "3..5",
              "4..5",
            ],
          ],
          [
            "5..8",
            [
              "5..8",
            ],
          ],
        ]
      `);
    });

    test('unsorted input panics', () => {
      const input = [i(2, 3), i(0, 1)];
      expect(() => collect(SplitIntoDisjointRanges.fromSortedIntervals(input))).toThrowError(
        'Input intervals were not properly sorted',
      );
    });

    test('inverted interval panics', () => {
      const bad: Interval<number, Range<number>> = [r(5, 3), r(5, 3)];
      const input = [bad];
      expect(() => collect(SplitIntoDisjointRanges.fromSortedIntervals(input))).toThrowError(
        'Interval start must be <= end',
      );
    });
  });

  describe('Parity with Rust tests', () => {
  test('handling of empty intervals at start points', () => {
      const input = [
        i(0, 5),
        i(4, 6),
        i(5, 5),
        i(5, 7),
        i(7, 7),
        i(10, 10),
        i(10, 11),
      ];
  const out = collect(SplitIntoDisjointRanges.fromSortedIntervals(input));
  const normalized = out.map(([range, labels]) => [range, labels.slice().map((l) => `${l}`).sort()] as const);
      expect(normalized).toMatchInlineSnapshot(`
        [
          [
            "0..4",
            [
              "0..5",
            ],
          ],
          [
            "4..5",
            [
              "0..5",
              "4..6",
            ],
          ],
          [
            "5..5",
            [
              "4..6",
              "5..5",
              "5..7",
            ],
          ],
          [
            "5..6",
            [
              "4..6",
              "5..7",
            ],
          ],
          [
            "6..7",
            [
              "5..7",
            ],
          ],
          [
            "7..7",
            [
              "7..7",
            ],
          ],
          [
            "10..10",
            [
              "10..10",
              "10..11",
            ],
          ],
          [
            "10..11",
            [
              "10..11",
            ],
          ],
        ]
      `);
    });

  test('larger composite example', () => {
      const input = [
        i(0, 5),
        i(2, 2),
        i(3, 8),
        i(8, 9),
        i(8, 8),
        i(10, 15),
        i(12, 20),
        i(20, 25),
        i(22, 30),
        i(23, 35),
      ];
  const out = collect(SplitIntoDisjointRanges.fromSortedIntervals(input));
  const normalized = out.map(([range, labels]) => [range, labels.slice().map((l) => `${l}`).sort()] as const);
      expect(normalized).toMatchInlineSnapshot(`
        [
          [
            "0..2",
            [
              "0..5",
            ],
          ],
          [
            "2..2",
            [
              "0..5",
              "2..2",
            ],
          ],
          [
            "2..3",
            [
              "0..5",
            ],
          ],
          [
            "3..5",
            [
              "0..5",
              "3..8",
            ],
          ],
          [
            "5..8",
            [
              "3..8",
            ],
          ],
          [
            "8..8",
            [
              "8..8",
              "8..9",
            ],
          ],
          [
            "8..9",
            [
              "8..9",
            ],
          ],
          [
            "10..12",
            [
              "10..15",
            ],
          ],
          [
            "12..15",
            [
              "10..15",
              "12..20",
            ],
          ],
          [
            "15..20",
            [
              "12..20",
            ],
          ],
          [
            "20..22",
            [
              "20..25",
            ],
          ],
          [
            "22..23",
            [
              "20..25",
              "22..30",
            ],
          ],
          [
            "23..25",
            [
              "20..25",
              "22..30",
              "23..35",
            ],
          ],
          [
            "25..30",
            [
              "22..30",
              "23..35",
            ],
          ],
          [
            "30..35",
            [
              "23..35",
            ],
          ],
        ]
      `);
    });
  });

  describe('ActiveIntervalsOrderedByEndpoint behavior', () => {
    test('nextEnd and isEmpty lifecycle', () => {
      const a = new ActiveIntervalsOrderedByEndpoint<number, string>(numberOps);
      expect(a.isEmpty()).toBe(true);
      expect(a.nextEnd()).toBeUndefined();

      a.add([r(0, 3), 'a']);
      expect(a.isEmpty()).toBe(false);
      expect(a.nextEnd()).toBe(3);

      a.add([r(1, 5), 'b']);
      expect(a.nextEnd()).toBe(3);

      a.add([r(0, 1), 'c']);
      expect(a.nextEnd()).toBe(1);

      a.forgetIntervalsEndingAtOrBefore(1);
      expect(a.nextEnd()).toBe(3);

      a.forgetIntervalsEndingAtOrBefore(2);
      expect(a.nextEnd()).toBe(3);
    });

    test('allLabels order agnostic', () => {
      const a = new ActiveIntervalsOrderedByEndpoint<number, string>(numberOps);
      a.add([r(0, 3), 'a']);
      a.add([r(1, 5), 'b']);
      a.add([r(2, 5), 'c']);

      const got1 = a.allLabels().slice().sort();
      expect(got1).toEqual(['a', 'b', 'c']);

      a.forgetIntervalsEndingAtOrBefore(3);
      const got2 = a.allLabels().slice().sort();
      expect(got2).toEqual(['b', 'c']);
    });

    test('forget removes all at or before', () => {
      const a = new ActiveIntervalsOrderedByEndpoint<number, string>(numberOps);
      a.add([r(0, 5), 'x1']);
      a.add([r(3, 5), 'x2']);
      a.add([r(5, 5), 'x0']);
      a.add([r(5, 6), 'y']);

      const before = a.allLabels().slice().sort();
      expect(before).toEqual(['x0', 'x1', 'x2', 'y']);

      a.forgetIntervalsEndingAtOrBefore(5);
      expect(a.nextEnd()).toBe(6);
      const after = a.allLabels().slice().sort();
      expect(after).toEqual(['y']);
    });

    test('add inverted interval panics', () => {
      const a = new ActiveIntervalsOrderedByEndpoint<number, string>(numberOps);
      expect(() => a.add([r(5, 3), 'bad'])).toThrowError('Interval start must be <= end');
    });
  });

  describe('K-way merge utilities', () => {
    test('kmerge with empty input', () => {
      const result = kmerge<number, string>([]);
      expect(result).toEqual([]);
    });

    test('kmerge with single list', () => {
      const list = [i(0, 3), i(5, 8)];
      const result = kmerge([list]);
      expect(result).toEqual(list);
    });

    test('kmerge with two lists', () => {
      const list1 = [i(0, 3), i(5, 8), i(10, 13)];
      const list2 = [i(2, 4), i(6, 9), i(11, 14)];
      const result = kmerge([list1, list2]);
      
      expect(result).toMatchInlineSnapshot(`
        [
          [
            "0..3",
            "0..3",
          ],
          [
            "2..4",
            "2..4",
          ],
          [
            "5..8",
            "5..8",
          ],
          [
            "6..9",
            "6..9",
          ],
          [
            "10..13",
            "10..13",
          ],
          [
            "11..14",
            "11..14",
          ],
        ]
      `);
    });

    test('kmerge with three lists', () => {
      const list1 = [i(0, 2), i(6, 8)];
      const list2 = [i(1, 3), i(7, 9)];
      const list3 = [i(4, 5), i(10, 12)];
      const result = kmerge([list1, list2, list3]);
      
      expect(result).toMatchInlineSnapshot(`
        [
          [
            "0..2",
            "0..2",
          ],
          [
            "1..3",
            "1..3",
          ],
          [
            "4..5",
            "4..5",
          ],
          [
            "6..8",
            "6..8",
          ],
          [
            "7..9",
            "7..9",
          ],
          [
            "10..12",
            "10..12",
          ],
        ]
      `);
    });

    test('kmerge maintains stability for equal start points', () => {
      const list1 = [i(5, 10), i(5, 15)];
      const list2 = [i(5, 8), i(5, 12)];
      const result = kmerge([list1, list2]);
      
      // When start points are equal, original list order should be preserved (list1 before list2)
      expect(result.map(([range]) => range.toString())).toEqual([
        '5..10', '5..15', '5..8', '5..12'
      ]);
    });

    test('kmerge with empty lists mixed in', () => {
      const list1 = [i(0, 3)];
      const list2: Interval<number, Range<number>>[] = [];
      const list3 = [i(2, 5)];
      const result = kmerge([list1, list2, list3]);
      
      expect(result).toMatchInlineSnapshot(`
        [
          [
            "0..3",
            "0..3",
          ],
          [
            "2..5",
            "2..5",
          ],
        ]
      `);
    });

    test('kmerge with different label types', () => {
      const list1: Array<Interval<number, string>> = [
        [r(0, 3), 'a'],
        [r(5, 8), 'b'],
      ];
      const list2: Array<Interval<number, string>> = [
        [r(2, 4), 'c'],
        [r(6, 9), 'd'],
      ];
      const result = kmerge([list1, list2]);
      
      expect(result).toMatchInlineSnapshot(`
        [
          [
            "0..3",
            "a",
          ],
          [
            "2..4",
            "c",
          ],
          [
            "5..8",
            "b",
          ],
          [
            "6..9",
            "d",
          ],
        ]
      `);
    });

    test('kmergeBy with custom comparator', () => {
      // Merge by end point instead of start point
      const byEndPoint = <L>(a: Interval<number, L>, b: Interval<number, L>) => 
        a[0].end < b[0].end;
      
      const list1 = [i(0, 3), i(5, 10)];
      const list2 = [i(2, 7), i(8, 12)];
      const result = kmergeBy([list1, list2], byEndPoint);
      
      // Should be sorted by end point: 3, 7, 10, 12
      expect(result.map(([range]) => range.toString())).toEqual([
        '0..3', '2..7', '5..10', '8..12'
      ]);
    });

    test('kmerge with tuple indices', () => {
      const pr = (s: [number, number], e: [number, number]) => 
        new Range<[number, number]>(s, e, tuple2NumberOps.show);
      
      const list1: Array<Interval<[number, number], string>> = [
        [pr([1, 1], [1, 3]), 'A'],
        [pr([2, 1], [2, 3]), 'B'],
      ];
      const list2: Array<Interval<[number, number], string>> = [
        [pr([1, 2], [1, 4]), 'C'],
        [pr([3, 1], [3, 3]), 'D'],
      ];
      
      const result = kmerge([list1, list2], tuple2NumberOps);
      
      expect(result).toMatchInlineSnapshot(`
        [
          [
            "(1,1)..(1,3)",
            "A",
          ],
          [
            "(1,2)..(1,4)",
            "C",
          ],
          [
            "(2,1)..(2,3)",
            "B",
          ],
          [
            "(3,1)..(3,3)",
            "D",
          ],
        ]
      `);
    });
  });

  describe('Multiple annotations with k-merge', () => {
    test('merge and split', () => {
      const Blue = 'Blue' as const;
      const Yellow = 'Yellow' as const;
      const Changed = 'Changed' as const;
      const Same = 'Same' as const;

      const syntaxHighlighting: Array<Interval<number, 'Blue' | 'Yellow'>> = [
        [r(0, 3), Blue],
        [r(5, 8), Yellow],
        [r(10, 13), Blue],
      ];
      const diffs: Array<Interval<number, 'Changed' | 'Same'>> = [
        [r(0, 2), Same],
        [r(2, 10), Changed],
        [r(10, 15), Same],
      ];

      const merged: Array<Interval<number, 'Blue' | 'Yellow' | 'Changed' | 'Same'>> = kmerge(
        [syntaxHighlighting, diffs],
      );
      expect(merged).toMatchInlineSnapshot(`
        [
          [
            "0..3",
            "Blue",
          ],
          [
            "0..2",
            "Same",
          ],
          [
            "2..10",
            "Changed",
          ],
          [
            "5..8",
            "Yellow",
          ],
          [
            "10..13",
            "Blue",
          ],
          [
            "10..15",
            "Same",
          ],
        ]
      `);

  const out = collect(SplitIntoDisjointRanges.fromSortedIntervals(merged));
      expect(out).toMatchInlineSnapshot(`
        [
          [
            "0..2",
            [
              "Blue",
              "Same",
            ],
          ],
          [
            "2..3",
            [
              "Blue",
              "Changed",
            ],
          ],
          [
            "3..5",
            [
              "Changed",
            ],
          ],
          [
            "5..8",
            [
              "Changed",
              "Yellow",
            ],
          ],
          [
            "8..10",
            [
              "Changed",
            ],
          ],
          [
            "10..13",
            [
              "Blue",
              "Same",
            ],
          ],
          [
            "13..15",
            [
              "Same",
            ],
          ],
        ]
      `);
    });
  });

  describe('Tuple index support', () => {
    test('lexicographic pair indices', () => {
      const pr = (s: [number, number], e: [number, number]) => new Range<[number, number]>(s, e, tuple2NumberOps.show);
      const input: Array<Interval<[number, number], string>> = [
        [pr([1, 1], [1, 3]), 'X'],
        [pr([1, 2], [1, 4]), 'Y'],
      ];
      const out = collect(SplitIntoDisjointRanges.fromSortedIntervals(input, tuple2NumberOps));
      expect(out).toMatchInlineSnapshot(`
        [
          [
            "(1,1)..(1,2)",
            [
              "X",
            ],
          ],
          [
            "(1,2)..(1,3)",
            [
              "X",
              "Y",
            ],
          ],
          [
            "(1,3)..(1,4)",
            [
              "Y",
            ],
          ],
        ]
      `);
    });
  });
}
