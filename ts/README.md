# disjoint-intervals (TypeScript)

A TypeScript port of the Rust library that splits an arbitrary set of labeled half-open intervals into disjoint segments labeled by the set of covering labels.

- Indices: number (half-open ranges `[start, end)`, represented as `[[start, end], label]`)
- Heap: `heap-js`
- Testing: Vitest, inline snapshots, in-source tests

## API

```ts
import { SplitIntoDisjointRanges, startPointBefore, type Interval } from './src/index.js';

const input: Array<Interval<string>> = [
  [[0, 3], 'a'],
  [[2, 5], 'b'],
];

const out = Array.from(SplitIntoDisjointRanges.fromSortedIntervals(input));
// => [ [[0,2],["a"]], [[2,3],["a","b"]], [[3,5],["b"]] ]
```

Inputs must be sorted by start (`startPointBefore` helper provided). Empty intervals (`start === end`) are allowed and produce 0-length segments. Inverted intervals (`start > end`) throw.

## Dev

- Run tests:

```fish
cd ts
npm install
npm run test
```

- Update inline snapshots if your changes alter expected output:

```fish
cd ts
npm run test -- -u
```

## Notes

- This port currently targets numeric indices. To generalize, parameterize by a comparator and key hash (or restrict to JS primitives that can be used as `Map` keys).
- Internal structure (`ActiveIntervalsOrderedByEndpoint`) is exported to allow testing, but can be treated as an implementation detail.
