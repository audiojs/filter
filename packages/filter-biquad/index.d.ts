type Buf = Float32Array | Float64Array
interface BiquadCoef { b0: number; b1: number; b2: number; a1: number; a2: number }

/** `fc`/`order`/`Q`/`fs` persisted on `params` — pass the same object across calls to keep state. */
export interface BiquadFilterParams {
  /** cutoff, Hz — required */
  fc: number
  /** filter order: 2 = RBJ biquad (default), 4+ = Butterworth cascade (requires `useButterworth` registered first) */
  order?: number
  /** quality factor, default 1/√2 (Butterworth, maximally flat) */
  Q?: number
  /** sample rate, Hz, default 44100 */
  fs?: number
  [key: string]: unknown
}

export interface BandpassParams {
  /** center frequency, Hz — required */
  fc: number
  /** quality factor, default 0.707 (note: differs from the raw `@audio/biquad` kernel's default of 1) */
  Q?: number
  /** sample rate, Hz, default 44100 */
  fs?: number
  [key: string]: unknown
}

export interface NotchParams {
  /** notch center frequency, Hz — required */
  fc: number
  /** quality factor (notch width), default 30 — narrow/hum-removal; lower (e.g. 5) for wider suppression */
  Q?: number
  /** sample rate, Hz, default 44100 */
  fs?: number
  [key: string]: unknown
}

/** Butterworth SOS designer, e.g. `digital-filter/iir/butterworth.js`'s default export. */
export type ButterworthDesigner = (order: number, fc: number, fs: number, type: 'lowpass' | 'highpass') => BiquadCoef[]

/** RBJ biquad lowpass (order 2, default) or Butterworth cascade (order 4+, requires `lowpass.useButterworth`). In-place. */
export function lowpass(data: Buf, params: BiquadFilterParams): Buf
export namespace lowpass {
  /** Register a Butterworth SOS designer once, before any `order > 2` call. */
  function useButterworth(designer: ButterworthDesigner): void
}

/** RBJ biquad highpass (order 2, default) or Butterworth cascade (order 4+, requires `highpass.useButterworth`). In-place. */
export function highpass(data: Buf, params: BiquadFilterParams): Buf
export namespace highpass {
  /** Register a Butterworth SOS designer once, before any `order > 2` call. */
  function useButterworth(designer: ButterworthDesigner): void
}

/** RBJ biquad bandpass, constant 0 dB peak gain. In-place. */
export function bandpass(data: Buf, params: BandpassParams): Buf

/** RBJ biquad notch — unity gain outside a deep null at `fc`. In-place. */
export function notch(data: Buf, params: NotchParams): Buf

export interface AllpassFirstParams {
  /** pole/coefficient — required, pole at z = −a */
  a: number
  /** input state x[n-1], default 0 (persisted) */
  x1?: number
  /** output state y[n-1], default 0 (persisted) */
  y1?: number
  [key: string]: unknown
}

export interface AllpassSecondParams {
  /** center frequency, Hz — required */
  fc: number
  /** quality factor — controls transition width around `fc`, default 1/√2 */
  Q?: number
  /** sample rate, Hz, default 44100 */
  fs?: number
  [key: string]: unknown
}

export namespace allpass {
  /** First-order allpass: H(z) = (a + z⁻¹) / (1 + a·z⁻¹). 180° phase shift at Nyquist. In-place. */
  function first(data: Buf, params: AllpassFirstParams): Buf
  /** Second-order (RBJ cookbook) allpass — 360° phase shift around `fc`, width set by `Q`. In-place. */
  function second(data: Buf, params: AllpassSecondParams): Buf
}
