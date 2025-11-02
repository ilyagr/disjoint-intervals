use std::{
    cmp::{Reverse, min},
    collections::BTreeMap,
    iter::Peekable,
    ops::Range,
};

// Alternative: "leap"? Get from starred repos.

pub type Interval<Ix, Label> = (Range<Ix>, Label);

#[derive(Debug, Clone)]
pub struct DisjointRanges<
    Ix: Ord + Copy,
    Label: Clone,
    InputIter: Iterator<Item = Interval<Ix, Label>>,
> {
    // Sorted by the *beginning* of each interval
    sorted_input: Peekable<InputIter>,
    current_position: Option<Ix>,
    // The set of intervals that `current_position` is inside of.
    //
    // The endpoint of each value should correspond to the key. The map is
    // sorted by the smallest endpoint.
    //
    // The start point is not actually necessary to compute DisjointRanges, we
    // could have values be `Vec<Label>`.
    //
    // TODO: Or binary heap?
    currently_active_intervals: BTreeMap<Reverse<Ix>, Vec<Interval<Ix, Label>>>,
}

impl<Ix: Ord + Copy, Label: Clone, InputIter: Iterator<Item = Interval<Ix, Label>>>
    DisjointRanges<Ix, Label, InputIter>
{
    /// `sorted_input` must be sorted by the *start* of each interval.
    /// `start_position` must be less than or equal to the start of the first interval in `sorted_input`.
    pub fn from_sorted_input(sorted_input: InputIter) -> DisjointRanges<Ix, Label, InputIter> {
        DisjointRanges {
            sorted_input: sorted_input.peekable(),
            current_position: None,
            currently_active_intervals: BTreeMap::new(),
        }
    }

    fn add_active_intervals(&mut self, interval: Interval<Ix, Label>) {
        // let end = interval.0.end;
        let (Range { start: _start, end }, _label) = &interval;
        self.currently_active_intervals
            .entry(Reverse(*end))
            .or_default()
            .push(interval);
    }

    fn next_active_interval_end(&self) -> Option<&Ix> {
        self.currently_active_intervals
            .keys()
            .next()
            .map(|Reverse(ix)| ix)
    }

    fn forget_intervals_ending_before(&mut self, position: &Ix) {
        while let Some((&Reverse(end), _)) = self.currently_active_intervals.first_key_value()
            && end <= *position
        {
            self.currently_active_intervals.remove(&Reverse(end));
        }
    }

    fn all_active_labels(&self) -> Vec<Label> {
        self.currently_active_intervals
            .values()
            .flat_map(|v| v.iter().map(|(_range, label)| label.clone()))
            .collect()
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
            let next_end = self.next_active_interval_end().cloned()?;
            let current_position = self
                .current_position
                .expect("current_position must be set if there are active intervals");
            self.current_position = Some(next_end);
            let labels = self.all_active_labels();
            self.forget_intervals_ending_before(&next_end);
            return Some((current_position..next_end, labels));
        };
        let next_range_start = *next_range_start;
        let current_position = *self.current_position.get_or_insert(next_range_start);
        if current_position < next_range_start {
            if let Some(next_end) = self.next_active_interval_end() {
                let stop_at = min(next_range_start, *next_end);
                let result = (current_position..stop_at, self.all_active_labels());
                self.current_position = Some(stop_at);
                self.forget_intervals_ending_before(&stop_at);
                return Some(result);
            } else {
                self.current_position = Some(next_range_start);
            }
        }

        // Now, current_position is the start of the next range, so this loop will always make at least one iteration.
        while let Some((Range { start, .. }, _label)) = self.sorted_input.peek()
            && *start == self.current_position.unwrap()
        {
            let (range, label) = self.sorted_input.next().unwrap();
            self.add_active_intervals((range, label));
        }
        let next_end = *self
            .next_active_interval_end()
            .expect("the loop above must have inserted at least one active interval");
        let result = (current_position..next_end, self.all_active_labels());
        self.current_position = Some(next_end);
        self.forget_intervals_ending_before(&next_end);
        Some(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn i(range: Range<usize>) -> Interval<usize, Range<usize>> {
        (range.clone(), range)
    }

    #[test]
    fn it_works() {
        let input = vec![i(0..5), i(3..7), i(10..15), i(12..20), i(20..25)];
        let result: Vec<_> = DisjointRanges::from_sorted_input(input.into_iter()).collect();
        dbg!(result);
        // TODO: empty range in input. Also maybe:
        dbg!(Range { start: 5, end: 3 });
    }
}
