type Buf = Float32Array | Float64Array | number[]
interface BiquadCoef { b0: number; b1: number; b2: number; a1: number; a2: number }
type SOS = BiquadCoef[]

export interface LpcParams {
  order?: number     // LPC order (default 12)
  [key: string]: unknown
}

export interface LpcResult {
  coefs: Float64Array    // LPC coefficients a[1..order] of A(z) = 1 + Σ a_k·z⁻ᵏ
  gain: number            // prediction-error gain (per-sample std of the whitening filter output, pre-normalization)
  residual: Float64Array  // whitened residual e[n] = A(z)x[n], normalized to unit power (divided by gain) — feed to lpcSynthesize as-is, or scale by a new gain to resynthesize
}

/** LPC analysis — autocorrelation + Levinson-Durbin. Throws if params.order is not set on a fresh params object (no default without one). */
export function lpcAnalysis(data: Buf, params: LpcParams): LpcResult

export interface LpcSynthParams {
  coefs: Float64Array | number[]
  gain?: number      // default 1
  [key: string]: unknown
}

/** LPC synthesis — all-pole filter reconstruction. y[n] = gain·excitation[n] − Σ coefs[k]·y[n−1−k], the algebraic inverse of lpcAnalysis's residual. */
export function lpcSynthesize(residual: Buf, params: LpcSynthParams): Buf
