type Buf = Float32Array | Float64Array

export interface OberheimParams {
  /** cutoff frequency, Hz, default 1000 */
  fc?: number
  /** resonance, 0–1, default 0 — mapped as damping R = 1 − resonance (inverted: resonance=1 gives R=0, maximum SVF resonance); bandpass peak gain is exactly 1/(2R) */
  resonance?: number
  /** sample rate, Hz, default 44100 */
  fs?: number
  /** output mode, default `'lowpass'` — all four modes come from the same 2-integrator state-variable core */
  type?: 'lowpass' | 'highpass' | 'bandpass' | 'notch'
  [key: string]: unknown
}

/**
 * Oberheim SEM state-variable filter (1974) — 2 trapezoidal (ZDF) integrators with
 * tanh-saturated feedback states, -12 dB/oct, continuous mode morphing (lowpass,
 * highpass, bandpass, notch) from one circuit. Unlike the ladder filters in this
 * repo, has no `drive` parameter — saturation is fixed on the integrator states.
 * In-place; stateful — pass the same `params` object across calls.
 */
declare function oberheim(data: Buf, params: OberheimParams): Buf
export default oberheim
