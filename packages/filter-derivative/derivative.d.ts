type Buf = Float32Array | Float64Array

export interface DerivativeParams {
  /** previous sample, default 0 (persisted) */
  prev?: number
  [key: string]: unknown
}

/** First-difference: data[n] = data[n] − prev. Exact inverse of `integral` at leak=1. In-place. */
export function derivative(data: Buf, params: DerivativeParams): Buf

export interface IntegralParams {
  /** per-sample leak on the accumulator, default 1 — 1 = exact FFmpeg `aintegral` (running sum, telescopes exactly against `derivative`); <1 bleeds the accumulator so DC-biased input converges to x_dc/(1−leak) instead of drifting */
  leak?: number
  /** running-sum accumulator, default 0 (persisted) */
  acc?: number
  [key: string]: unknown
}

/** Running sum: acc = acc*leak + data[n]; data[n] = acc. In-place. */
export function integral(data: Buf, params: IntegralParams): Buf

/** One block of `derivative` in place, allocating nothing: `s` a `Float64Array` holding prev, kept from call to call. */
export function derivativeBlock(data: Buf, s: Float64Array): Buf

/** One block of `integral` in place, allocating nothing: `s` a `Float64Array` of acc (kept from call to call) and leak. */
export function integralBlock(data: Buf, s: Float64Array): Buf
