use std::{cmp::min, collections::BTreeMap, fmt::Debug, iter::Peekable, ops::Range};

// Alternative: <https://github.com/sstadick/rust-lapper>. It stores the entire
// tree of intervals, we don't.

/// A labeled half-open interval: `start..end` and a label
pub type Interval<Ix, Label> = (Range<Ix>, Label);

/// Can be used with [`itertools::kmerge_by`] to merge multiple sorted interval iterators.
pub fn start_point_before<Ix: Ord, Label>(
    a: &Interval<Ix, Label>,
    b: &Interval<Ix, Label>,
) -> bool {
    a.0.start < b.0.start
}

/// Iterator that intersects a set of intervals until it becomes disjoint.
///
/// Computes the disjoint intersections of an arbitrary set of labeled half-open
/// intervals. The result is a set of disjoint intervals, each one an
/// intersection of some of the original intervals. Each resulting disjoint
/// interval is labeled with the vector of the labels of all the input intervals
/// that contain the resulting interval.
///
/// Empty intervals (with `start == end`) are allowed and are considered as though
/// they were located at the starting point but had negligible length. They are
/// considered as intersecting any interval with the same starting point, but
/// they do not intersect an interval with a smaller starting point and the same
/// ending point. This may be useful, for example, when `Ix=usize` to represent
/// positions in a text that are in between characters (such as a cursor).
///
/// Inverted intervals (with `start > end`) are not allowed and will cause a
/// panic.
#[derive(Debug, Clone)]
pub struct SplitIntoDisjointRanges<
    Ix: Ord + Clone,
    Label: Clone,
    InputIter: Iterator<Item = Interval<Ix, Label>>,
> {
    /// Sorted by the *beginning* of each interval
    sorted_input: Peekable<InputIter>,
    /// Position of the "current" index
    position: Option<Ix>,
    // The set of intervals that `position` is inside of, sorted by the *ending
    // point* of each interval. Elements are added and removed as needed during
    // iteration.
    active_intervals: ActiveIntervalsOrderedByEndpoint<Ix, Label>,
}

impl<Ix: Ord + Clone, Label: Clone, InputIter: Iterator<Item = Interval<Ix, Label>>>
    SplitIntoDisjointRanges<Ix, Label, InputIter>
{
    /// Initialize from input sorted by the *start* of each interval.
    ///
    /// Empty intervals are OK. Iterating will panic if any interval has `start >
    /// end` (not sure why Rust allows that).
    ///
    /// [`start_point_before`] can be used with `itertools::kmerge_by` or
    /// `sort_by` to get appropriately ordered intervals.
    pub fn from_sorted_intervals(
        sorted_intervals: InputIter,
    ) -> SplitIntoDisjointRanges<Ix, Label, InputIter> {
        SplitIntoDisjointRanges {
            sorted_input: sorted_intervals.peekable(),
            position: None,
            active_intervals: ActiveIntervalsOrderedByEndpoint::new(),
        }
    }
}

impl<Ix: Ord + Clone, Label: Clone, InputIter: Iterator<Item = Interval<Ix, Label>>> Iterator
    for SplitIntoDisjointRanges<Ix, Label, InputIter>
{
    type Item = Interval<Ix, Vec<Label>>;

    fn next(&mut self) -> Option<Self::Item> {
        let mut next_range_start;
        loop {
            next_range_start = self
                .sorted_input
                .peek()
                .map(|(Range { start, .. }, _label)| start.clone());
            if self.position.is_none() {
                assert!(
                    self.active_intervals.is_empty(),
                    "Very first next() invocation"
                );
                // Note the `?` that returns None if everything is empty
                self.position = Some(next_range_start.as_ref()?.clone());
            };
            match next_range_start {
                Some(next_start) if next_start < self.position.as_ref().unwrap().clone() => {
                    panic!("Input intervals were not properly sorted")
                }
                Some(next_start) if next_start == self.position.as_ref().unwrap().clone() => {
                    let (range, label) = self.sorted_input.next().unwrap();
                    self.active_intervals.add((range, label));
                }
                _ => {
                    // The range between self.position and next_range_start does
                    // not have any new intervals to add to the active set.
                    // Think of `self.position` as negative infinity if it is
                    // `None`, and of `next_range_start` as positive infinity if
                    // it is `None`.
                    if !self.active_intervals.is_empty() {
                        break;
                    };
                    // No active intervals, and no new intervals to add, so we
                    // can either skip ahead or quit
                    self.position = Some(next_range_start.as_ref()?.clone());
                }
            }
        }

        let next_end = self.active_intervals.next_end().cloned().unwrap();
        let stop_at = match next_range_start {
            Some(next_start) => min(next_start, next_end),
            None => next_end,
        };
        let result = (
            self.position.as_ref().unwrap().clone()..stop_at.clone(),
            self.active_intervals.all_labels(),
        );

        self.position = Some(stop_at.clone());
        self.active_intervals
            .forget_intervals_ending_at_or_before(&stop_at);
        Some(result)
    }
}

#[derive(Clone)]
struct ActiveIntervalsOrderedByEndpoint<Ix: Ord + Clone, Label: Clone>(
    /// The key of the mapping is the endpoint of each interval in the value
    /// vector. The mapping is sorted by the smallest endpoint.
    //
    // The start point is not actually necessary to compute DisjointRanges, we
    // could have values be `Vec<Label>`.
    //
    // TODOs: Possible optimizations to consider.
    // - Use a binary heap for keys and a `HashMap` or `IndexMap` for storing
    // values with fast lookup and interation.
    // - Use a SmallVec for labels, since there will usually only be a few kinds
    // of labels that overlap and the number is usually known at compile time.
    // We'd then want to parametrize by the number of elements to initialize
    // SmallVec with.
    BTreeMap<Ix, Vec<Interval<Ix, Label>>>,
);

impl<Ix: Ord + Clone, Label: Clone> ActiveIntervalsOrderedByEndpoint<Ix, Label> {
    fn new() -> Self {
        ActiveIntervalsOrderedByEndpoint(BTreeMap::new())
    }

    fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    fn add(&mut self, interval: Interval<Ix, Label>) {
        let (Range { start, end }, _label) = &interval;
        // Could alternatively do `let end = max(start, end);` and adjust the
        // docs accordintly.
        assert!(start <= end, "Interval start must be <= end");
        self.0.entry(end.clone()).or_default().push(interval);
    }

    /// The smallest endpoint of all intervals in the set
    fn next_end(&self) -> Option<&Ix> {
        self.0.keys().next()
    }

    fn forget_intervals_ending_at_or_before(&mut self, position: &Ix) {
        while let Some(end) = self.next_end().cloned()
            && end <= *position
        {
            self.0.remove(&end);
        }
    }

    fn all_labels(&self) -> Vec<Label> {
        self.0
            .values()
            .flat_map(|v| v.iter().map(|(_range, label)| label.clone()))
            .collect()
    }
}

impl<Ix: Ord + Clone + std::fmt::Debug, Label: Clone + Debug> Debug
    for ActiveIntervalsOrderedByEndpoint<Ix, Label>
{
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

#[cfg(test)]
mod tests {
    use std::ops::RangeBounds;

    use insta::assert_debug_snapshot;

    use itertools::Itertools as _;

    use super::*;

    fn i(range: Range<usize>) -> Interval<usize, Range<usize>> {
        (range.clone(), range)
    }

    #[test]
    fn test_algorithm() {
        let empty: Vec<Interval<usize, ()>> = vec![];
        let result: Vec<_> =
            SplitIntoDisjointRanges::from_sorted_intervals(empty.into_iter()).collect();
        assert_debug_snapshot!(result, @"[]");
        let input = vec![
            i(0..5),
            i(2..2),
            i(3..8),
            i(8..9),
            i(8..8),
            i(10..15),
            i(12..20),
            i(20..25),
            i(22..30),
            i(23..35),
        ];
        let result: Vec<_> =
            SplitIntoDisjointRanges::from_sorted_intervals(input.into_iter()).collect();
        assert_debug_snapshot!(result, @r"
        [
            (
                0..2,
                [
                    0..5,
                ],
            ),
            (
                2..2,
                [
                    2..2,
                    0..5,
                ],
            ),
            (
                2..3,
                [
                    0..5,
                ],
            ),
            (
                3..5,
                [
                    0..5,
                    3..8,
                ],
            ),
            (
                5..8,
                [
                    3..8,
                ],
            ),
            (
                8..8,
                [
                    8..8,
                    8..9,
                ],
            ),
            (
                8..9,
                [
                    8..9,
                ],
            ),
            (
                10..12,
                [
                    10..15,
                ],
            ),
            (
                12..15,
                [
                    10..15,
                    12..20,
                ],
            ),
            (
                15..20,
                [
                    12..20,
                ],
            ),
            (
                20..22,
                [
                    20..25,
                ],
            ),
            (
                22..23,
                [
                    20..25,
                    22..30,
                ],
            ),
            (
                23..25,
                [
                    20..25,
                    22..30,
                    23..35,
                ],
            ),
            (
                25..30,
                [
                    22..30,
                    23..35,
                ],
            ),
            (
                30..35,
                [
                    23..35,
                ],
            ),
        ]
        ");
        // TODO: empty range in input. Also maybe:
        let weird = Range { start: 5, end: 3 };
        dbg!(weird.clone(), weird.end, weird.end_bound());
    }

    #[derive(Debug, Clone)]
    enum Color {
        Blue,
        Yellow,
    }

    #[derive(Debug, Clone)]
    enum Diff {
        Changed,
        Same,
    }

    #[derive(Clone)]
    enum Annotation {
        Color(Color),
        Diff(Diff),
    }

    impl Debug for Annotation {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            let s = match self {
                Annotation::Color(color) => format!("Color({color:?})"),
                Annotation::Diff(diff) => format!("Diff({diff:?})"),
            };
            f.write_str(&s)
        }
    }

    #[test]
    fn test_mutliple_annotations() {
        use Color::*;
        use Diff::*;
        // Has to be sorted
        let syntax_highlighting = vec![(0..3, Blue), (5..8, Yellow), (9..15, Blue)];
        let diffs = vec![(0..2, Same), (2..10, Changed), (11..15, Same)];

        assert!(syntax_highlighting.is_sorted_by(start_point_before));
        assert!(diffs.is_sorted_by(start_point_before));
        let input: Vec<Vec<_>> = vec![
            syntax_highlighting
                .into_iter()
                .map(|(range, color)| (range, Annotation::Color(color)))
                .collect(),
            diffs
                .into_iter()
                .map(|(range, diff)| (range, Annotation::Diff(diff)))
                .collect(),
        ];

        // If the inputs are sorted, kmerge_by will efficiently preserve the order.
        let input: Vec<_> = input.into_iter().kmerge_by(start_point_before).collect();
        assert_debug_snapshot!(input, @r"
        [
            (
                0..3,
                Color(Blue),
            ),
            (
                0..2,
                Diff(Same),
            ),
            (
                2..10,
                Diff(Changed),
            ),
            (
                5..8,
                Color(Yellow),
            ),
            (
                9..15,
                Color(Blue),
            ),
            (
                11..15,
                Diff(Same),
            ),
        ]
        ");
        let result: Vec<_> =
            SplitIntoDisjointRanges::from_sorted_intervals(input.into_iter()).collect();
        assert_debug_snapshot!(result, @r"
        [
            (
                0..2,
                [
                    Diff(Same),
                    Color(Blue),
                ],
            ),
            (
                2..3,
                [
                    Color(Blue),
                    Diff(Changed),
                ],
            ),
            (
                3..5,
                [
                    Diff(Changed),
                ],
            ),
            (
                5..8,
                [
                    Color(Yellow),
                    Diff(Changed),
                ],
            ),
            (
                8..9,
                [
                    Diff(Changed),
                ],
            ),
            (
                9..10,
                [
                    Diff(Changed),
                    Color(Blue),
                ],
            ),
            (
                10..11,
                [
                    Color(Blue),
                ],
            ),
            (
                11..15,
                [
                    Color(Blue),
                    Diff(Same),
                ],
            ),
        ]
        ");
    }
}
