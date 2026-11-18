type Buf = Float32Array | Float64Array

export interface CombParams {
  /** delay, samples, at least 1; required. Between two samples it reads between them; a new delay glides across the call */
  delay: number
  /** feedforward/feedback gain, default 0.5 — a true null (feedforward) or infinite peak (feedback) only at |gain|=1 */
  gain?: number
  /** `'feedforward'` (FIR, dips): H(z) = 1 + gain·z⁻ᴰ. `'feedback'` (IIR, peaks): H(z) = 1 / (1 − gain·z⁻ᴰ). Default `'feedforward'` */
  type?: 'feedforward' | 'feedback'
  [key: string]: unknown
}

/**
 * Comb filter — delayed copy of the signal added to itself, notches/peaks at harmonics of fs/delay. In-place; the ring
 * buffer persists on `params` across calls. A new delay is reached across the call from the last call's, the read no
 * faster than double speed and no slower than half; a delay longer than the ring holds makes a new one, empty.
 */
declare function comb(data: Buf, params: CombParams): Buf
export default comb

/**
 * The delay in samples a time in seconds asks for at `fs`, at least 1: within a Float32 step (2^-23) of a whole frame, that
 * frame (@audio/effect's delay reads the same way)
 */
export function delaySamples(time: number, fs: number): number

/**
 * One block in place, allocating nothing: what the `/audio` manifest calls. `buf` the ring, at least floor(delay) + 2
 * long; `s` a `Float64Array` of the write position, the delay the last call ended on and where its read was (NaN, NaN
 * before the first call); `set` a `Float64Array` of the delay in samples, the gain, and 1 for feedback, 0 feedforward;
 * `gains`, when given, the gain each frame in place of `set`'s (the manifest's glide while the gain moves).
 */
export function combBlock(data: Buf, buf: Float64Array, s: Float64Array, set: Float64Array, gains?: Float64Array): Buf
