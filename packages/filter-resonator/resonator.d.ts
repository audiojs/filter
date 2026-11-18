type Buf = Float32Array | Float64Array

export interface ResonatorParams {
  /** center frequency, Hz — required */
  fc: number
  /** sample rate, Hz, default 44100 */
  fs?: number
  /** bandwidth, Hz, default 50 — smaller bw = higher Q; bw → 0 gives infinite Q */
  bw?: number
  [key: string]: unknown
}

/**
 * Constant-peak-gain resonator (JOS two-zero form) — two zeros at z=±1 normalize the
 * pole peak to exactly 0 dB regardless of `fc`/`bw`, unlike a plain RBJ bandpass whose
 * peak gain shifts with Q. Used for modal synthesis (bells, drums) and formant banks.
 * In-place; stateful — pass the same `params` object across calls. Internal cache
 * fields are prefixed `_r*` so `params` can be shared with a caller-owned object
 * (e.g. one formant band's own state) without key collisions.
 */
declare function resonator(data: Buf, params: ResonatorParams): Buf
export default resonator

/** The resonator's section at `fc`, `bw` and `fs`: b0, b2, a1, a2 written into `c` (a `Float64Array(4)`, made if absent) and returned. */
export function resonatorCoefs(fc: number, bw: number, fs: number, c?: Float64Array): Float64Array

/** One block in place, allocating nothing: what the `/audio` manifest calls. `s` a `Float64Array` of x1, x2, y1, y2 kept from call to call, `c` the section `resonatorCoefs` writes. */
export function resonatorBlock(data: Buf, s: Float64Array, c: Float64Array): Buf
