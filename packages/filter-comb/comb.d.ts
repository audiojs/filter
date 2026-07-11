type Buf = Float32Array | Float64Array

export interface CombParams {
  /** delay length, samples — required (0 or missing degenerates to a zero-length ring buffer) */
  delay: number
  /** feedforward/feedback gain, default 0.5 — a true null (feedforward) or infinite peak (feedback) only at |gain|=1 */
  gain?: number
  /** `'feedforward'` (FIR, dips): H(z) = 1 + gain·z⁻ᴰ. `'feedback'` (IIR, peaks): H(z) = 1 / (1 − gain·z⁻ᴰ). Default `'feedforward'` */
  type?: 'feedforward' | 'feedback'
  [key: string]: unknown
}

/** Comb filter — delayed copy of the signal added to itself, notches/peaks at harmonics of fs/delay. In-place; the ring buffer persists on `params` across calls. */
declare function comb(data: Buf, params: CombParams): Buf
export default comb
