import { Heap } from 'heap-js';

export class Range {
  constructor(public start: number, public end: number) {}
  toString(): string {
    return `${this.start}..${this.end}`;
  }
  toJSON(): string {
    // Make snapshots render ranges as a concise string
    return this.toString();
  }
}

export type Interval<Label> = [Range, Label];

export function startPointBefore<Label>(a: Interval<Label>, b: Interval<Label>): boolean {
  return a[0].start < b[0].start;
}

export class ActiveIntervalsOrderedByEndpoint<Label> {
  private heap: Heap<number>;
  private map: Map<number, Array<Interval<Label>>>;

  constructor() {
    // Min-heap over numeric end points
    this.heap = new Heap<number>((a, b) => a - b);
    this.map = new Map();
  }

  isEmpty(): boolean {
    return this.map.size === 0;
  }

  add(interval: Interval<Label>): void {
    const [{ start, end }] = interval;
    if (!(start <= end)) throw new Error('Interval start must be <= end');

    const endKey = end;
    const isNewKey = !this.map.has(endKey);
    const arr = this.map.get(endKey) ?? [];
    arr.push(interval);
    if (isNewKey) this.heap.push(endKey);
    this.map.set(endKey, arr);
  }

  nextEnd(): number | undefined {
    return this.heap.peek();
  }

  forgetIntervalsEndingAtOrBefore(position: number): void {
    while (this.heap.peek() !== undefined && (this.heap.peek() as number) <= position) {
      const end = this.heap.pop();
      if (end === undefined) break;
      this.map.delete(end);
    }
  }

  allLabels(): Label[] {
    // iterate ends in ascending numeric order, preserve insertion order within same end
    const ends = Array.from(this.map.keys()).sort((a, b) => a - b);
    const out: Label[] = [];
    for (const e of ends) {
      const intervals = this.map.get(e)!;
      for (const [, label] of intervals) out.push(label);
    }
    return out;
  }
}

export class SplitIntoDisjointRanges<Label> implements Iterable<Interval<Label[]>> {
  private iter: Iterator<Interval<Label>>;
  private lookahead: IteratorResult<Interval<Label>> | null = null;
  private position: number | undefined = undefined;
  private active = new ActiveIntervalsOrderedByEndpoint<Label>();

  private constructor(sortedIntervals: Iterable<Interval<Label>>) {
    this.iter = sortedIntervals[Symbol.iterator]();
  }

  static fromSortedIntervals<Label>(
    sortedIntervals: Iterable<Interval<Label>>,
  ): SplitIntoDisjointRanges<Label> {
    return new SplitIntoDisjointRanges(sortedIntervals);
  }

  private peek(): Interval<Label> | undefined {
    if (this.lookahead === null) this.lookahead = this.iter.next();
    return this.lookahead.done ? undefined : this.lookahead.value;
  }

  private next(): Interval<Label> | undefined {
    const v = this.peek();
    this.lookahead = null;
    return v;
  }

  [Symbol.iterator](): Iterator<Interval<Label[]>> {
    const self = this;
    return (function* () {
      while (true) {
  let thisIntervalStart: number;

        // Establish start position and admit all intervals at that start
        while (true) {
          if (self.position === undefined) {
            const p = self.peek();
            if (!p) return; // no input at all
            self.position = p[0].start;
          }
          thisIntervalStart = self.position as number;

          // Admit all intervals starting at this position
          while (true) {
            const nxt = self.peek();
            if (!nxt) break;
            const start = nxt[0].start;
            if (start < thisIntervalStart)
              throw new Error('Input intervals were not properly sorted');
            if (start !== thisIntervalStart) break;
            // starts exactly at position, admit it
            const got = self.next()!;
            self.active.add(got);
          }

          if (self.active.isEmpty()) {
            // nothing active yet, move position to next start (if any), and loop
            const nxt = self.peek();
            if (!nxt) return; // completely done
            const nextStart = nxt[0].start;
            if (nextStart < thisIntervalStart)
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

        let stopAt = nextActiveEnd;
        if (nextRangeStart !== undefined && nextRangeStart < stopAt) stopAt = nextRangeStart;

  const labels = self.active.allLabels();
  const result: Interval<Label[]> = [new Range(thisIntervalStart, stopAt), labels];
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

  const r = (start: number, end: number) => new Range(start, end);
  const i = (start: number, end: number): Interval<Range> => [r(start, end), r(start, end)];

  function collect<Label>(iterable: Iterable<Interval<Label>>): Array<Interval<Label>> {
    return Array.from(iterable);
  }

  describe('SplitIntoDisjointRanges basic', () => {
    test('empty input', () => {
      const input: Array<Interval<never>> = [];
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
              "5..6",
              "5..7",
              "5..10",
            ],
          ],
          [
            "5..6",
            [
              "5..6",
              "5..7",
              "5..10",
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
  const bad: Interval<Range> = [r(5, 3), r(5, 3)];
      const input = [bad];
      expect(() => collect(SplitIntoDisjointRanges.fromSortedIntervals(input))).toThrowError(
        'Interval start must be <= end',
      );
    });
  });

  describe('ActiveIntervalsOrderedByEndpoint behavior', () => {
    test('nextEnd and isEmpty lifecycle', () => {
      const a = new ActiveIntervalsOrderedByEndpoint<string>();
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
      const a = new ActiveIntervalsOrderedByEndpoint<string>();
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
      const a = new ActiveIntervalsOrderedByEndpoint<string>();
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
      const a = new ActiveIntervalsOrderedByEndpoint<string>();
  expect(() => a.add([r(5, 3), 'bad'])).toThrowError('Interval start must be <= end');
    });
  });

  describe('Multiple annotations with k-merge', () => {
    const kmergeBy = <L>(
      lists: Array<Array<Interval<L>>>,
      less: (a: Interval<L>, b: Interval<L>) => boolean,
    ): Array<Interval<L>> => {
      type Node = { value: Interval<L>; idx: number; list: number };
      const heap = new Heap<Node>((a, b) => (less(a.value, b.value) ? -1 : less(b.value, a.value) ? 1 : a.list - b.list));
      const heads = new Array<number>(lists.length).fill(0);
      for (let li = 0; li < lists.length; li++) {
        if (lists[li].length > 0) heap.push({ value: lists[li][0], idx: 0, list: li });
      }
      const out: Array<Interval<L>> = [];
      while (!heap.isEmpty()) {
        const { value, idx, list } = heap.pop()!;
        out.push(value);
        const nextIdx = idx + 1;
        if (nextIdx < lists[list].length) heap.push({ value: lists[list][nextIdx], idx: nextIdx, list });
      }
      return out;
    };

    test('merge and split', () => {
      const Blue = 'Blue' as const;
      const Yellow = 'Yellow' as const;
      const Changed = 'Changed' as const;
      const Same = 'Same' as const;

      const syntaxHighlighting: Array<Interval<'Blue' | 'Yellow'>> = [
        [r(0, 3), Blue],
        [r(5, 8), Yellow],
        [r(10, 13), Blue],
      ];
      const diffs: Array<Interval<'Changed' | 'Same'>> = [
        [r(0, 2), Same],
        [r(2, 10), Changed],
        [r(10, 15), Same],
      ];

      const merged: Array<Interval<'Blue' | 'Yellow' | 'Changed' | 'Same'>> = kmergeBy(
        [syntaxHighlighting as Array<Interval<'Blue' | 'Yellow'>>, diffs as Array<Interval<'Changed' | 'Same'>>] as any,
        startPointBefore,
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
              "Same",
              "Blue",
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
              "Yellow",
              "Changed",
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
}
