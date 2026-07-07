// audio-filter/weighting — TypeScript declarations

export type Buf = Float32Array | Float64Array | number[]

/** One biquad section: H(z) = (b0 + b1*z⁻¹ + b2*z⁻²) / (1 + a1*z⁻¹ + a2*z⁻²) */
export interface BiquadCoef { b0: number; b1: number; b2: number; a1: number; a2: number }

/** Array of biquad sections (second-order sections) */
export type SOS = BiquadCoef[]

export interface WeightingParams { fs?: number; state?: [number, number][] | null; [key: string]: unknown }

type WeightingFilter = { (data: Buf, params?: WeightingParams): Buf; coefs(fs?: number): SOS }

/** IEC 61672 A-weighting, in-place. `.coefs(fs)` returns SOS for analysis. */
export const aWeighting: WeightingFilter
/** IEC 61672 C-weighting, in-place. `.coefs(fs)` returns SOS for analysis. */
export const cWeighting: WeightingFilter
/** ITU-R BS.1770 K-weighting, in-place. `.coefs(fs)` returns SOS for analysis. */
export const kWeighting: WeightingFilter
/** ITU-R BS.468-4 noise-weighting, in-place. `.coefs(fs)` returns SOS for analysis (3 sections, exact matched-z of the analog prototype). */
export const itu468: WeightingFilter
/** RIAA playback equalization, in-place. `.coefs(fs)` returns SOS for analysis. */
export const riaa: WeightingFilter
