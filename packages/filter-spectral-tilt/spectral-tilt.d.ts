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
