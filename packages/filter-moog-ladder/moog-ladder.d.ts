type Buf = Float32Array | Float64Array

export interface MoogLadderParams {
  /** cutoff frequency, Hz, default 1000 */
  fc?: number
  /** resonance, 0–1, default 0 — feedback k = 4·resonance, self-oscillates (pure sine, runs indefinitely) exactly at resonance=1 */
  resonance?: number
  /** sample rate, Hz, default 44100 */
  fs?: number
  /** input drive into the tanh saturation at the filter input, default 1 — `drive: 0` mutes the signal (tanh(0)=0) rather than disabling saturation */
  drive?: number
  /** default 'lowpass': the ladder's taps mixed into a highpass or bandpass (JUCE / Pedalboard LadderFilter modes) */
  type?: 'lowpass' | 'highpass' | 'bandpass'
  /** 4 (default): -24 dB/oct, bandpass ±12; 2: -12 dB/oct, bandpass ±6 */
  poles?: 2 | 4
  [key: string]: unknown
}

/**
 * Moog 4-pole transistor ladder filter (Robert Moog, 1965) — zero-delay-feedback
 * (trapezoidal integration) cascade of 4 one-pole sections, -24 dB/oct (or its taps
 * mixed: highpass, bandpass, 2 poles), tanh
 * saturation at the input only (unlike `diodeLadder`'s per-stage saturation).
 * In-place; stateful — pass the same `params` object across calls.
 */
declare function moogLadder(data: Buf, params: MoogLadderParams): Buf
export default moogLadder

/**
 * One block in place, allocating nothing: what the `/audio` manifest calls. `s` the 4 integrator states (a
 * `Float64Array` kept from call to call), `set` a `Float64Array` of fc, resonance, drive and fs, `poles` 2 or 4.
 * `fade`, when given and under way (`moogFade` starts one), moves the output from the taps it had to this type's.
 */
export function moogBlock(data: Buf, s: Float64Array, set: Float64Array, type: 'lowpass' | 'highpass' | 'bandpass', poles: 2 | 4, fade?: Float64Array): Buf

/**
 * Starts a fade (or restarts one under way) from the taps the output has, those of `type` and `poles` or a fade's blend,
 * toward the taps `moogBlock` is next given. `fade` a `Float64Array(7)`: where it is (0 to 1; 1 is done), its step a
 * sample (1 / the samples it lasts), the 5 weights it begins from. The weights move along t²(3 − 2t).
 */
export function moogFade(fade: Float64Array, type: 'lowpass' | 'highpass' | 'bandpass', poles: 2 | 4): Float64Array
