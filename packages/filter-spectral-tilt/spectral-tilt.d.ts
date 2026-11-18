type Buf = Float32Array | Float64Array

export interface SpectralTiltParams {
  /** slope in dB/octave, default 0 (no-op) — positive boosts highs, negative cuts them; e.g. -3 = pink-noise character, -6 = brownian/red noise */
  slope?: number
  /** sample rate, Hz, default 44100 */
  fs?: number
  [key: string]: unknown
}

/**
 * Spectral tilt — cascade of 8 octave-spaced first-order shelving sections (62.5 Hz
 * … up to fs/2) approximating a fractional power-law spectrum S(f) ∝ f^slope.
 * Measured slope tracks the requested dB/oct to within ~20% (inherent to the 8-stage
 * cascade) — e.g. `slope: 3` measures ≈2.4 dB/oct, `slope: -6` measures ≈-4.9 dB/oct.
 * In-place; stateful — pass the same `params` object across calls.
 */
declare function spectralTilt(data: Buf, params: SpectralTiltParams): Buf
export default spectralTilt

/**
 * The cascade for `slope` dB/octave at `fs`, written into `c` (a `Float64Array(10)`, made if absent) and returned: c[0] the
 * stages (octaves from 62.5 Hz under fs/2), c[1] the gain each applies above its corner, c[2…] their poles.
 */
export function tiltCoefs(slope: number, fs: number, c?: Float64Array): Float64Array

/**
 * One block in place, allocating nothing: what the `/audio` manifest calls. `s` a `Float64Array(8)` of the stages' states
 * kept from call to call, `c` the cascade `tiltCoefs` writes; `gains`, when given, each frame's gain per octave
 * (10^(slope/20)) in place of `c[1]` (the manifest's glide while the slope moves).
 */
export function tiltBlock(data: Buf, s: Float64Array, c: Float64Array, gains?: Float64Array): Buf

/**
 * At slope 0 the cascade is the identity: `data` passes unchanged while each stage's one-pole follows it, so a slope
 * moving off 0 starts from the states the cascade has there.
 */
export function tiltIdle(data: Buf, s: Float64Array, c: Float64Array): Buf
