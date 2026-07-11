type Buf = Float32Array | Float64Array

export interface Korg35Params {
  /** cutoff frequency, Hz, default 1000 */
  fc?: number
  /** resonance, 0–1, default 0 — feedback k = 2·resonance; only 2 real poles in the loop, so this never reaches self-oscillation at any setting (adds damping/saturation character instead) */
  resonance?: number
  /** sample rate, Hz, default 44100 */
  fs?: number
  /** input drive into the feedback-path tanh saturation, default 1 */
  drive?: number
  /** output tap, default `'lowpass'` — `'highpass'` = input − lowpass (exactly complementary only at resonance=0; the HP tap's extra feedback term makes LP+HP diverge from the input as resonance increases) */
  type?: 'lowpass' | 'highpass'
  [key: string]: unknown
}

/**
 * Korg35 filter (Korg MS-10/MS-20, 1978) — 2 cascaded one-pole trapezoidal (ZDF)
 * sections with nonlinear feedback, -12 dB/oct. Lowpass and highpass taps from
 * one circuit; never self-oscillates. In-place; stateful — pass the same `params`
 * object across calls.
 */
declare function korg35(data: Buf, params: Korg35Params): Buf
export default korg35
