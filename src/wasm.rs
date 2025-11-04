use crate::SplitIntoDisjointRanges;
use js_sys::{Array, Object, Reflect};
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmRange {
    pub start: u32,
    pub end: u32,
}

#[wasm_bindgen]
impl WasmRange {
    #[wasm_bindgen(constructor)]
    pub fn new(start: u32, end: u32) -> WasmRange {
        WasmRange { start, end }
    }
}

#[wasm_bindgen]
pub fn add(a: u32, b: u32) -> u32 {
    a + b
}

/// A streaming iterator for processing disjoint intervals.
/// Allows feeding intervals one at a time and pulling results incrementally.
#[wasm_bindgen]
pub struct DisjointIntervalsIterator {
    // We need to box the iterator to make it work with wasm_bindgen
    iter: Box<dyn Iterator<Item = (std::ops::Range<u32>, Vec<()>)>>,
}

#[wasm_bindgen]
impl DisjointIntervalsIterator {
    /// Create a new streaming iterator.
    /// Note: This still requires passing all intervals upfront, but processes them lazily.
    #[wasm_bindgen(constructor)]
    pub fn new(input: &JsValue) -> DisjointIntervalsIterator {
        let arr = js_sys::Array::from(input);
        let mut intervals = Vec::with_capacity(arr.length() as usize);
        for val in arr.iter() {
            let start = Reflect::get(&val, &JsValue::from_str("start"))
                .unwrap()
                .as_f64()
                .unwrap() as u32;
            let end = Reflect::get(&val, &JsValue::from_str("end"))
                .unwrap()
                .as_f64()
                .unwrap() as u32;
            intervals.push((start..end, ()))
        }
        let iter = SplitIntoDisjointRanges::from_sorted_intervals(intervals.into_iter());
        DisjointIntervalsIterator {
            iter: Box::new(iter),
        }
    }

    /// Get the next disjoint interval, or null if done.
    /// Returns a JS object with {start, end} properties.
    #[wasm_bindgen(js_name = nextInterval)]
    pub fn next_interval(&mut self) -> JsValue {
        match self.iter.next() {
            Some((range, _labels)) => {
                let obj = Object::new();
                Reflect::set(
                    &obj,
                    &JsValue::from_str("start"),
                    &JsValue::from(range.start),
                )
                .unwrap();
                Reflect::set(&obj, &JsValue::from_str("end"), &JsValue::from(range.end)).unwrap();
                obj.into()
            }
            None => JsValue::NULL,
        }
    }

    /// Collect all remaining intervals into an array.
    #[wasm_bindgen]
    pub fn collect(&mut self) -> Array {
        let out = Array::new();
        for (range, _labels) in self.iter.by_ref() {
            let obj = Object::new();
            Reflect::set(
                &obj,
                &JsValue::from_str("start"),
                &JsValue::from(range.start),
            )
            .unwrap();
            Reflect::set(&obj, &JsValue::from_str("end"), &JsValue::from(range.end)).unwrap();
            out.push(&obj);
        }
        out
    }
}

/// A builder for constructing a streaming disjoint intervals iterator.
/// Allows adding intervals one at a time in sorted order (by start point).
#[wasm_bindgen]
pub struct DisjointIntervalsBuilder {
    intervals: Vec<(std::ops::Range<u32>, ())>,
}

impl Default for DisjointIntervalsBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl DisjointIntervalsBuilder {
    /// Create a new builder.
    #[wasm_bindgen(constructor)]
    pub fn new() -> DisjointIntervalsBuilder {
        DisjointIntervalsBuilder {
            intervals: Vec::new(),
        }
    }

    /// Add an interval to the builder.
    /// IMPORTANT: Intervals must be added in sorted order by start point.
    /// If not sorted, the iterator will panic when processing.
    #[wasm_bindgen(js_name = addInterval)]
    pub fn add_interval(&mut self, start: u32, end: u32) {
        self.intervals.push((start..end, ()));
    }

    /// Build and return the iterator. Consumes the builder.
    /// This is where the actual iterator is created and can start producing results.
    #[wasm_bindgen]
    pub fn build(self) -> DisjointIntervalsIterator {
        let iter = SplitIntoDisjointRanges::from_sorted_intervals(self.intervals.into_iter());
        DisjointIntervalsIterator {
            iter: Box::new(iter),
        }
    }
}

/// Accepts an array of JS objects {start, end}, returns an array of {start, end} objects for disjoint intervals
#[wasm_bindgen]
pub fn disjoint_intervals_obj(input: &JsValue) -> Array {
    let arr = js_sys::Array::from(input);
    let mut intervals = Vec::with_capacity(arr.length() as usize);
    for val in arr.iter() {
        let start = Reflect::get(&val, &JsValue::from_str("start"))
            .unwrap()
            .as_f64()
            .unwrap() as u32;
        let end = Reflect::get(&val, &JsValue::from_str("end"))
            .unwrap()
            .as_f64()
            .unwrap() as u32;
        intervals.push((start..end, ()))
    }
    let result = SplitIntoDisjointRanges::from_sorted_intervals(intervals.into_iter());
    let out = Array::new();
    for (range, _labels) in result {
        let obj = Object::new();
        Reflect::set(
            &obj,
            &JsValue::from_str("start"),
            &JsValue::from(range.start),
        )
        .unwrap();
        Reflect::set(&obj, &JsValue::from_str("end"), &JsValue::from(range.end)).unwrap();
        out.push(&obj);
    }
    out
}
