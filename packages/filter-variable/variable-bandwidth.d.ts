type Buf = Float32Array | Float64Array

export interface VariableBandwidthParams {
  /** target cutoff/center frequency, Hz, default 1000 */
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
