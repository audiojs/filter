type Buf = Float32Array | Float64Array

export interface VariableBandwidthParams {
  /** target cutoff/center frequency, Hz, default 1000; above 0.49·fs held there */
  fc?: number
  /** target quality factor, default 0.707 */
  Q?: number
  /** sample rate, Hz, default 44100 */
  fs?: number
  /** biquad shape, default `'lowpass'` */
  type?: 'lowpass' | 'highpass' | 'bandpass'
  [key: string]: unknown
}

/**
 * Lowpass/highpass/bandpass with continuously variable bandwidth — `fc`/`Q` are
 * exponentially smoothed toward their target values with a 5 ms time constant, and
 * biquad coefficients are recomputed from the smoothed values every sample (not once
 * per buffer), so a mid-buffer `fc`/`Q` change produces no discontinuity — unlike
 * `filter-biquad`'s `lowpass`/`highpass`/`bandpass`, which recompute once per call and
 * click on a coefficient jump. Once converged, steady-state output equals the plain
 * biquad shape. In-place; stateful — pass the same `params` object across calls.
 */
declare function variableBandwidth(data: Buf, params: VariableBandwidthParams): Buf
export default variableBandwidth

/**
 * One block in place, allocating nothing: what the `/audio` manifest calls. `s` a `Float64Array` of the section's two
 * states and the smoothed fc and Q (kept from call to call; NaN fc and Q start at the targets), `set` a `Float64Array`
 * of the target fc (held to 0.49·fs), Q and fs, `c` a section (`@audio/biquad`'s) the last frame's coefficients are
 * written into; each frame's are computed here, by `@audio/biquad`'s arithmetic. `fade`, when given and under way
 * (`variableFade` starts one), moves the output from the blend of types it had to `type` over its course: the three
 * types share one denominator, so the section runs in direct form during the fade, each type's numerator on the same
 * history, the output their blend.
 */
export function variableBlock(data: Buf, s: Float64Array, set: Float64Array, c: { b0: number, b1: number, b2: number, a1: number, a2: number }, type: 'lowpass' | 'highpass' | 'bandpass', fade?: Float64Array): Buf

/**
 * Starts a fade, or restarts one under way, toward the type `variableBlock` is next given, from the blend the output
 * has: `type` (the last given) alone, or the blend of a fade under way. `fade` a `Float64Array(6)` of where it is (0 to
 * 1; made at 1, none under way), its step a frame (1 / the frames it lasts), the weights of lowpass, highpass and
 * bandpass it begins from, and 1 while the section runs in direct form. The weights move along t²(3 − 2t).
 */
export function variableFade(fade: Float64Array, type: 'lowpass' | 'highpass' | 'bandpass'): Float64Array
