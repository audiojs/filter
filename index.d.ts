// @audio/filter — TypeScript declarations

export type Buf = Float32Array | Float64Array | number[]
export interface BiquadCoef { b0: number; b1: number; b2: number; a1: number; a2: number }
export type SOS = BiquadCoef[]

export interface LadderParams {
  fc?: number        // cutoff frequency Hz (default 1000)
  resonance?: number // 0–1, self-oscillation at 1 (moogLadder) / ≈1.15–1.2 (diodeLadder)
  fs?: number        // sample rate (default 44100)
  drive?: number     // input drive / saturation amount (default 1)
  [key: string]: unknown
}

/** Moog 4-pole transistor ladder lowpass — ZDF, –24 dB/oct, self-oscillates at resonance=1 */
export function moogLadder(data: Buf, params: LadderParams): Buf

/** Diode ladder lowpass (Roland TB-303 style) — bidirectionally-coupled ZDF tridiagonal solve, –24 dB/oct, self-oscillates at resonance≈1.15–1.2 */
export function diodeLadder(data: Buf, params: LadderParams): Buf

export interface Korg35Params extends LadderParams {
  type?: 'lowpass' | 'highpass' // default 'lowpass'. Never self-oscillates (2-pole loop can't reach -180° phase at finite frequency); LP+HP=input holds exactly only at resonance=0
}

/** Korg35 2-pole filter (MS-20 style) — ZDF, –12 dB/oct */
export function korg35(data: Buf, params: Korg35Params): Buf

export interface OberheimParams {
  fc?: number        // cutoff frequency Hz (default 1000)
  resonance?: number // 0–1 (default 0), maps to SVF damping R=1-resonance; peak gain 1/(2R)
  type?: 'lowpass' | 'highpass' | 'bandpass' | 'notch' // default 'lowpass'
  fs?: number        // sample rate (default 44100)
  [key: string]: unknown
}

/** Oberheim SEM 2-pole state-variable filter — ZDF, –12 dB/oct, multimode. No drive param. */
export function oberheim(data: Buf, params: OberheimParams): Buf

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

export interface DerivativeParams { [key: string]: unknown } // no options (FFmpeg aderivative has none) — params carries filter state
export interface IntegralParams { leak?: number; [key: string]: unknown } // leak default 1 (exact running sum); <1 anti-drift extension
/** Derivative (first difference) H(z) = 1 − z⁻¹ — FFmpeg aderivative */
export function derivative(data: Buf, params?: DerivativeParams): Buf
/** Integral (running sum) H(z) = 1/(1 − z⁻¹) at leak=1 — FFmpeg aintegral. leak<1 leaks the accumulator to stay finite on DC-biased material. */
export function integral(data: Buf, params?: IntegralParams): Buf

export interface ResonatorParams { fc: number; bw?: number; fs?: number; [key: string]: unknown } // bw default 50
/** Constant-peak-gain resonator (JOS two-zero form) — modal synthesis (bells, drums, formants). Peak gain is exactly 0dB at fc for any bw. Throws if params.fc is omitted. */
export function resonator(data: Buf, params: ResonatorParams): Buf

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
