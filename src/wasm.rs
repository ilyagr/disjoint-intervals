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
