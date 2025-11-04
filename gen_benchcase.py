import marimo

__generated_with = "0.17.7"
app = marimo.App(width="medium")


@app.cell
def _():
    # import marimo as mo
    import numpy as np
    from pprint import pprint
    return np, pprint


@app.cell
def _(np):
    n_boundaries = 100
    layers = 10
    width_lower_bound = 500
    boundaries = np.random.choice(np.arange(width_lower_bound), size=(layers, n_boundaries))
    boundaries.sort()
    boundaries[:2]
    return boundaries, layers, n_boundaries


@app.cell
def _(boundaries):
    right_sides=boundaries[:,1:]
    left_sides=boundaries[:,:-1]
    left_sides[:2]
    return left_sides, right_sides


@app.cell
def _(layers, n_boundaries, np):
    offset_max_size = 5
    unsummed_offsets = np.random.choice(np.arange(offset_max_size), size=(layers, n_boundaries-2))
    unsummed_offsets.cumsum(axis=1)[:2]
    return (unsummed_offsets,)


@app.cell
def _(left_sides, np, right_sides):
    unoffsetted_intervals = np.array([list(zip(left,right)) for left, right in zip(left_sides, right_sides)])
    unoffsetted_intervals[:,:3,:]
    return


@app.cell
def _(left_sides, np, offsets, right_sides):
    # `layers` annotation types, `n_boundaries -1` disjoint intervals with gaps `<= offset_max_size` for each annotatin type.
    offsetted_intervals = np.array([list(zip(left,right)) for left, right in zip(left_sides+offsets, right_sides+offsets)],dtype=int)
    offsetted_intervals[:,:3,:]
    return (offsetted_intervals,)


@app.cell
def _(offsetted_intervals):
    sort_of_prettyprinted={ix: ", ".join(f"{start}..{end}" for (start,end) in row) for (ix, row) in enumerate(offsetted_intervals)}
    return (sort_of_prettyprinted,)


@app.cell
def _(pprint, sort_of_prettyprinted):
    pprint({k:sort_of_prettyprinted[k] for k in [1,5]})
    return


@app.cell
def _(layers, np, unsummed_offsets):
    offsets = np.concat([np.zeros(layers).reshape(layers,1), unsummed_offsets.cumsum(axis=1)], axis=1) 
    offsets[:2]
    return (offsets,)


if __name__ == "__main__":
    app.run()
