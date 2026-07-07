// audio-filter/effect — TypeScript declarations

import type { Buf, SOS } from '../weighting/index.js'

export interface DcBlockerParams { R?: number; [key: string]: unknown } // R default 0.995
/** DC blocking filter H(z) = (1−z⁻¹)/(1−R·z⁻¹) */
export function dcBlocker(data: Buf, params?: DcBlockerParams): Buf

export interface CombParams {
  delay: number      // delay in samples
  gain?: number      // feedback/feedforward gain (default 0.5)
  type?: 'feedforward' | 'feedback' // default 'feedforward'
  [key: string]: unknown
}
/** Comb filter (feedforward FIR or feedback IIR). Reallocates the delay line when params.delay changes on a reused params object. */
export function comb(data: Buf, params: CombParams): Buf

export interface AllpassParams { a?: number; fc?: number; Q?: number; fs?: number; [key: string]: unknown }
/** Allpass filters — unity magnitude, frequency-dependent phase shift */
export declare namespace allpass {
  /** First-order allpass: H(z) = (a + z⁻¹) / (1 + a·z⁻¹). params.a is required for meaningful output. */
  function first(data: Buf, params: AllpassParams): Buf
  /** Second-order allpass via RBJ biquad. params.fc required, Q default 0.707, fs default 44100. */
  function second(data: Buf, params: AllpassParams): Buf
}

export interface EmphasisParams { alpha?: number; [key: string]: unknown } // alpha default 0.97
/** Pre-emphasis H(z) = 1 − α·z⁻¹ */
export function emphasis(data: Buf, params?: EmphasisParams): Buf
/** De-emphasis H(z) = 1/(1 − α·z⁻¹) */
export function deemphasis(data: Buf, params?: EmphasisParams): Buf

export interface ResonatorParams { fc: number; bw?: number; fs?: number; [key: string]: unknown } // bw default 50
/** Constant-peak-gain resonator (JOS two-zero form) — modal synthesis (bells, drums, formants). Peak gain is exactly 0dB at fc for any bw. Throws if params.fc is omitted. */
export function resonator(data: Buf, params: ResonatorParams): Buf

/** Paul Kellet pink-noise filter (IIR approximation, -3dB/oct) applied to white noise input */
export function pinkNoise(data: Buf, params?: Record<string, unknown>): Buf

export interface SpectralTiltParams { slope?: number; fs?: number; [key: string]: unknown } // slope default 0 (dB/octave, positive = boost highs)
/** Spectral tilt — cascade of octave-spaced first-order shelving sections, ±dB/oct */
export function spectralTilt(data: Buf, params?: SpectralTiltParams): Buf

export interface VariableBandwidthParams {
  fc?: number        // default 1000
  Q?: number         // default 0.707
  fs?: number        // default 44100
  type?: 'lowpass' | 'highpass' | 'bandpass' // default 'lowpass'
  [key: string]: unknown
}
/** Variable-bandwidth biquad filter — fc/Q exponentially smoothed (5ms time constant) and coefficients recomputed every sample, eliminating coefficient-jump clicks on mid-stream parameter changes */
export function variableBandwidth(data: Buf, params?: VariableBandwidthParams): Buf

export interface FilterParams {
  fc: number         // cutoff/center frequency Hz — required, throws if omitted
  Q?: number         // quality factor (default 0.707)
  order?: number     // filter order: 2 = biquad, 4+ = Butterworth cascade (default 2)
  fs?: number        // sample rate (default 44100)
  [key: string]: unknown
}

type Butterworth = (order: number, fc: number, fs: number, type: 'lowpass' | 'highpass') => SOS

/** Highpass filter — removes below cutoff. Order 2: RBJ biquad. Order 4+: Butterworth SOS (requires highpass.useButterworth(butterworth) to be called once, see digital-filter/iir/butterworth.js). Throws if params.fc is omitted. */
export function highpass(data: Buf, params: FilterParams): Buf
export declare namespace highpass { function useButterworth(bw: Butterworth): void }

/** Lowpass filter — removes above cutoff. Order 2: RBJ biquad. Order 4+: Butterworth SOS (requires lowpass.useButterworth(butterworth) to be called once, see digital-filter/iir/butterworth.js). Throws if params.fc is omitted. */
export function lowpass(data: Buf, params: FilterParams): Buf
export declare namespace lowpass { function useButterworth(bw: Butterworth): void }

export interface BandpassParams {
  fc: number         // center frequency Hz — required, throws if omitted
  Q?: number         // quality factor (default 0.707)
  fs?: number        // sample rate (default 44100)
  [key: string]: unknown
}

/** Bandpass filter — passes around center frequency, rejects rest. RBJ biquad (constant 0dB peak gain). Throws if params.fc is omitted. */
export function bandpass(data: Buf, params: BandpassParams): Buf

export interface NotchParams {
  fc: number         // notch frequency Hz — required, throws if omitted
  Q?: number         // quality factor (default 30)
  fs?: number        // sample rate (default 44100)
  [key: string]: unknown
}

/** Notch (band-reject) filter — unity gain except null at fc. Throws if params.fc is omitted. */
export function notch(data: Buf, params: NotchParams): Buf
