type Buf = Float32Array | Float64Array

export interface MoogLadderParams {
  /** cutoff frequency, Hz, default 1000 */
  fc?: number
  /** resonance, 0–1, default 0 — feedback k = 4·resonance, self-oscillates (pure sine, runs indefinitely) exactly at resonance=1 */
  resonance?: number
  /** sample rate, Hz, default 44100 */
  fs?: number
  /** input drive into the tanh saturation at the filter input, default 1 — `drive: 0` mutes the signal (tanh(0)=0) rather than disabling saturation */
  drive?: number
  [key: string]: unknown
}

/**
 * Moog 4-pole transistor ladder filter (Robert Moog, 1965) — zero-delay-feedback
 * (trapezoidal integration) cascade of 4 one-pole sections, -24 dB/oct, tanh
 * saturation at the input only (unlike `diodeLadder`'s per-stage saturation).
 * In-place; stateful — pass the same `params` object across calls.
 */
declare function moogLadder(data: Buf, params: MoogLadderParams): Buf
export default moogLadder
