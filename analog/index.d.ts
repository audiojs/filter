// audio-filter/analog — TypeScript declarations

import type { Buf } from '../weighting/index.js'

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
