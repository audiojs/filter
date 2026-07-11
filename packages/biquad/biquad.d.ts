/** Second-order-section coefficients, normalized a0 = 1 (RBJ Audio-EQ-Cookbook). */
export interface BiquadCoef { b0: number; b1: number; b2: number; a1: number; a2: number }

/** Transposed direct-form-II state for one section: [z1, z2]. */
export type BiquadState = Float64Array

/** coefs (section or SOS array) + state, persisted on the object across calls (streaming convention). */
export interface FilterParams {
  coefs: BiquadCoef | BiquadCoef[]
  state?: BiquadState[]
  [key: string]: unknown
}

/** −12 dB/oct lowpass. `Q` default 1/√2 (Butterworth, maximally flat). */
export function lowpass(fc: number, Q?: number, fs?: number): BiquadCoef
/** −12 dB/oct highpass. `Q` default 1/√2. */
export function highpass(fc: number, Q?: number, fs?: number): BiquadCoef
/** Constant 0 dB peak-gain bandpass. `Q` default 1. */
export function bandpass(fc: number, Q?: number, fs?: number): BiquadCoef
/** Band-reject, unity gain outside the notch. `Q` default 1. */
export function notch(fc: number, Q?: number, fs?: number): BiquadCoef
/** Unity magnitude, frequency-dependent phase. `Q` default 1/√2. */
export function allpass(fc: number, Q?: number, fs?: number): BiquadCoef
/** Peaking EQ bell. `Q` default 1, `dB` default 0. */
export function peaking(fc: number, Q?: number, fs?: number, dB?: number): BiquadCoef
/** Low-shelf. `Q` default 1/√2, `dB` default 0. */
export function lowshelf(fc: number, Q?: number, fs?: number, dB?: number): BiquadCoef
/** High-shelf. `Q` default 1/√2, `dB` default 0. */
export function highshelf(fc: number, Q?: number, fs?: number, dB?: number): BiquadCoef

/** Fresh section state: `Float64Array(2)`, both accumulators zeroed. */
export function state(): BiquadState

/** Process a whole buffer through one section, in place. Creates fresh state if omitted. */
export function process(data: Float32Array | Float64Array, c: BiquadCoef, s?: BiquadState): Float32Array | Float64Array

/** One sample through one section — sidechain/per-sample use. */
export function step(c: BiquadCoef, s: BiquadState, x: number): number

/** SOS chain: buffer through each section of `coefs` in series, in place. `states` is one `state()` per section (created if omitted). */
export function cascade(data: Float32Array | Float64Array, coefs: BiquadCoef[], states?: BiquadState[]): Float32Array | Float64Array

/**
 * Params-convention kernel: `params.coefs` (section or SOS array) drives the cascade,
 * `params.state` persists across calls — the ecosystem's streaming idiom. Pass the same
 * `params` object on every call to carry state across block boundaries; throws if
 * `params.coefs` is missing or malformed.
 */
export function filter(data: Float32Array | Float64Array, params: FilterParams): Float32Array | Float64Array

/** |H(f)| of one section at frequency `f` — analysis/plotting. */
export function magnitude(c: BiquadCoef, f: number, fs?: number): number

/** |H(f)| of a cascade (SOS array) — product of each section's magnitude. */
export function cascadeMagnitude(sos: BiquadCoef[], f: number, fs?: number): number
