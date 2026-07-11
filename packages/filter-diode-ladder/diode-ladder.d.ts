type Buf = Float32Array | Float64Array

export interface DiodeLadderParams {
  /** cutoff frequency, Hz, default 1000 */
  fc?: number
  /** resonance, 0–1, default 0 — feedback k = 4·resonance (same mapping as `moogLadder`), but the per-stage tanh adds damping so self-oscillation shifts to ≈1.15–1.2 instead of exactly 1 */
  resonance?: number
  /** sample rate, Hz, default 44100 */
  fs?: number
  /** input drive into the tanh saturation path, default 1 — `drive: 0` mutes the signal (tanh(0)=0) rather than disabling saturation */
  drive?: number
  [key: string]: unknown
}

/**
 * Diode ladder filter (Roland TB-303 / EMS VCS3 style) — zero-delay-feedback 4-pole
 * lowpass with bidirectionally-coupled stages (no unity-gain buffers between them,
 * unlike `moogLadder`), solved as one tridiagonal system per sample. Per-stage tanh
 * saturation gives the characteristic acid "squelch". In-place; stateful — pass the
 * same `params` object across calls.
 */
declare function diodeLadder(data: Buf, params: DiodeLadderParams): Buf
export default diodeLadder
