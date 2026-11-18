type Buf = Float32Array | Float64Array

export interface Korg35Params {
  /** cutoff frequency, Hz, default 1000 */
  fc?: number
  /** resonance, 0–1, default 0 — feedback k = 2·resonance; only 2 real poles in the loop, so this never reaches self-oscillation at any setting (adds damping/saturation character instead) */
  resonance?: number
  /** sample rate, Hz, default 44100 */
  fs?: number
  /** input drive into the feedback-path tanh saturation, default 1 */
  drive?: number
  /** output tap, default `'lowpass'` — `'highpass'` = input − lowpass (exactly complementary only at resonance=0; the HP tap's extra feedback term makes LP+HP diverge from the input as resonance increases) */
  type?: 'lowpass' | 'highpass'
  [key: string]: unknown
}

/**
 * Korg35 filter (Korg MS-10/MS-20, 1978) — 2 cascaded one-pole trapezoidal (ZDF)
 * sections with nonlinear feedback, -12 dB/oct. Lowpass and highpass taps from
 * one circuit; never self-oscillates. In-place; stateful — pass the same `params`
 * object across calls.
 */
declare function korg35(data: Buf, params: Korg35Params): Buf
export default korg35

/**
 * One block in place, allocating nothing: what the `/audio` manifest calls. `s` the 2 integrator states (a
 * `Float64Array` kept from call to call), `set` a `Float64Array` of fc, resonance, drive and fs, `hp` the highpass tap.
 * `fade`, when given and under way (`korg35Fade` starts one), moves the output from the taps it had to this one's.
 */
export function korg35Block(data: Buf, s: Float64Array, set: Float64Array, hp: boolean, fade?: Float64Array): Buf

/**
 * Starts a fade (or restarts one under way) from the taps the output has, those of `hp` at `set`'s resonance or a
 * fade's blend, toward the tap `korg35Block` is next given. `fade` a `Float64Array(4)`: where it is (0 to 1; 1 is
 * done), its step a sample, the weights on the input and y2 it begins from. The weights move along t²(3 − 2t).
 */
export function korg35Fade(fade: Float64Array, hp: boolean, set: Float64Array): Float64Array
