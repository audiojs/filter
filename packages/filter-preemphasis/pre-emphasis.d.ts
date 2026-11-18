type Buf = Float32Array | Float64Array

export interface EmphasisParams {
  /** coefficient, default 0.97 — GSM/AMR speech coding convention */
  alpha?: number
  /** input state x[n-1], default 0 (persisted) */
  x1?: number
  [key: string]: unknown
}

/** Pre-emphasis: H(z) = 1 − α·z⁻¹. First-order highpass — boosts above fc ≈ (1−α)·fs/(2π). In-place. */
export function emphasis(data: Buf, params: EmphasisParams): Buf

export interface DeemphasisParams {
  /** coefficient, default 0.97 — must match the `emphasis` call it inverts */
  alpha?: number
  /** output state y[n-1], default 0 (persisted) */
  y1?: number
  [key: string]: unknown
}

/** De-emphasis: H(z) = 1 / (1 − α·z⁻¹). Exact inverse of `emphasis` at the same `alpha`. In-place. */
export function deemphasis(data: Buf, params: DeemphasisParams): Buf

/**
 * One block of `emphasis` in place, allocating nothing: `s` a `Float64Array` of x1 (kept from call to call) and alpha;
 * `alphas`, when given, alpha each frame in its place (the manifest's glide while alpha moves).
 */
export function emphasisBlock(data: Buf, s: Float64Array, alphas?: Float64Array): Buf

/**
 * One block of `deemphasis` in place, allocating nothing: `s` a `Float64Array` of y1 (kept from call to call) and alpha;
 * `alphas`, when given, alpha each frame in its place (the manifest's glide while alpha moves).
 */
export function deemphasisBlock(data: Buf, s: Float64Array, alphas?: Float64Array): Buf
