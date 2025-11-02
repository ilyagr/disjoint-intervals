use std::{cmp::min, collections::BTreeMap, iter::Peekable, ops::Range};

// Alternative: "leap"? Get from starred repos.

pub type Interval<Ix, Label> = (Range<Ix>, Label);

#[derive(Debug, Clone)]
pub struct DisjointRanges<
    Ix: Ord + Copy,
    Label: Clone,
    InputIter: Iterator<Item = Interval<Ix, Label>>,
> {
    /// Sorted by the *beginning* of each interval
    sorted_input: Peekable<InputIter>,
    /// Position of the "current" index
    position: Option<Ix>,
    // The set of intervals that `position` is inside of.
    //
    // The endpoint of each value should correspond to the key. The map is
    // sorted by the smallest endpoint.
    currently_active_intervals: ActiveIntervalsOrderedByEndpoint<Ix, Label>,
}

impl<Ix: Ord + Copy, Label: Clone, InputIter: Iterator<Item = Interval<Ix, Label>>>
    DisjointRanges<Ix, Label, InputIter>
{
    /// `sorted_input` must be sorted by the *start* of each interval.
    /// Iterating will panix if any interval has start > end (not sure why Rust allows that). Empty intervals are OK.
    pub fn from_sorted_input(sorted_input: InputIter) -> DisjointRanges<Ix, Label, InputIter> {
        DisjointRanges {
            sorted_input: sorted_input.peekable(),
            position: None,
            currently_active_intervals: ActiveIntervalsOrderedByEndpoint::new(),
        }
    }
}

impl<Ix: Ord + Copy, Label: Clone, InputIter: Iterator<Item = Interval<Ix, Label>>> Iterator
    for DisjointRanges<Ix, Label, InputIter>
{
    type Item = Interval<Ix, Vec<Label>>;

    fn next(&mut self) -> Option<Self::Item> {
        let Some((
            Range {
                start: next_range_start,
                ..
            },
            _next_label,
        )) = self.sorted_input.peek()
        else {
            // No more input intervals; still need to process any remaining active intervals.
            let next_end = self
                .currently_active_intervals
                .next_interval_end()
                .cloned()?;
            let current_position = self
                .position
                .expect("current_position must be set if there are active intervals");
            self.position = Some(next_end);
            let labels = self.currently_active_intervals.all_labels();
            self.currently_active_intervals
                .forget_intervals_ending_before(&next_end);
            return Some((current_position..next_end, labels));
        };
        let next_range_start = *next_range_start;
        let current_position = *self.position.get_or_insert(next_range_start);
        if current_position < next_range_start {
            if let Some(next_end) = self.currently_active_intervals.next_interval_end() {
                let stop_at = min(next_range_start, *next_end);
                let result = (
                    current_position..stop_at,
                    self.currently_active_intervals.all_labels(),
                );
                self.position = Some(stop_at);
                self.currently_active_intervals
                    .forget_intervals_ending_before(&stop_at);
                return Some(result);
            } else {
                self.position = Some(next_range_start);
            }
        }

        // Now, current_position is the start of the next input range's start, so this loop will always make at least one iteration.
        while let Some((Range { start, .. }, _label)) = self.sorted_input.peek()
            && *start == self.position.unwrap()
        {
            let (range, label) = self.sorted_input.next().unwrap();
            self.currently_active_intervals.add((range, label));
        }

        // Now, `current_position < (next input range start)` again.
        self.next()
    }
}

#[derive(Debug, Clone)]
#[repr(transparent)]
struct ActiveIntervalsOrderedByEndpoint<Ix: Ord + Copy, Label: Clone>(
    // The start point is not actually necessary to compute DisjointRanges, we
    // could have values be `Vec<Label>`.
    //
    // TODO: Or reversed binary heap?
    BTreeMap<Ix, Vec<Interval<Ix, Label>>>,
);

impl<Ix: Ord + Copy, Label: Clone> ActiveIntervalsOrderedByEndpoint<Ix, Label> {
    fn new() -> Self {
        ActiveIntervalsOrderedByEndpoint(BTreeMap::new())
    }

    fn add(&mut self, interval: Interval<Ix, Label>) {
        let (Range { start, end }, _label) = &interval;
        // Could alternatively do `let end = max(start, end);`
        assert!(start <= end, "Interval start must be <= end");
        self.0.entry(*end).or_default().push(interval);
    }

    fn next_interval_end(&self) -> Option<&Ix> {
        self.0.keys().next()
    }

    fn forget_intervals_ending_before(&mut self, position: &Ix) {
        while let Some(end) = self.0.keys().next().cloned()
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

#[cfg(test)]
mod tests {
    use std::ops::RangeBounds;

    use super::*;

    fn i(range: Range<usize>) -> Interval<usize, Range<usize>> {
        (range.clone(), range)
    }

    #[test]
    fn it_works() {
        let input = vec![
            i(0..5),
            i(2..2),
            i(3..7),
            i(8..8),
            i(10..15),
            i(12..20),
            i(20..25),
        ];
        let result: Vec<_> = DisjointRanges::from_sorted_input(input.into_iter()).collect();
        dbg!(result);
        // TODO: empty range in input. Also maybe:
        let weird = Range { start: 5, end: 3 };
        dbg!(weird.clone(), weird.end, weird.end_bound());
    }
}
