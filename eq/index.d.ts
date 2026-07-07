// audio-filter/eq — TypeScript declarations

import type { Buf, SOS } from '../weighting/index.js'

export interface GraphicEqParams {
  gains?: Record<number, number>  // { 31.5: dB, 63: dB, 125: dB, 250: dB, 500: dB, 1000: dB, 2000: dB, 4000: dB, 8000: dB, 16000: dB } — ISO 266 / IEC 61260-1 1/1-octave nominal band keys only, unset keys default to 0 dB
  fs?: number
  [key: string]: unknown
}

/** ISO 266 octave-band graphic equalizer (10 bands: 31.5 Hz – 16 kHz), in-place, cascaded biquads */
export function graphicEq(data: Buf, params: GraphicEqParams): Buf

export interface PeqBand {
  fc: number
  Q?: number         // default 1 for type 'peak', 0.707 (RBJ maximally-flat) for 'lowshelf'/'highshelf'
  gain?: number       // dB (default 0)
  type?: 'peak' | 'lowshelf' | 'highshelf' // default 'peak'
}

export interface ParametricEqParams {
  bands?: PeqBand[]
  fs?: number
  [key: string]: unknown
}

/** Multi-band parametric EQ, in-place. Filters rebuild automatically whenever any band's fc/Q/gain/type or fs changes. */
export function parametricEq(data: Buf, params: ParametricEqParams): Buf

/** Linkwitz-Riley crossover — returns one SOS array per output band. order default 4, fs default 44100. For order ≡ 2 (mod 4) (LR2, LR6, …) alternate bands are polarity-inverted internally so the returned bands sum flat by construction. */
export function crossover(frequencies: number[], order?: number, fs?: number): SOS[]

export interface CrossfeedParams {
  fc?: number        // crossfeed cutoff Hz (default 700)
  level?: number     // mix 0–1 (default 0.3)
  fs?: number
  [key: string]: unknown
}

/** Bauer stereophonic-to-binaural crossfeed, in-place on both channels. direct+cross mix sums to unity (mono/correlated content stays at ~unity gain). Returns the same buffers for convenience. */
export function crossfeed(left: Buf, right: Buf, params: CrossfeedParams): { left: Buf, right: Buf }

export interface ShelfParams {
  fc?: number        // corner frequency Hz — default 200 for lowShelf, 4000 for highShelf
  gain?: number      // dB boost/cut (default 0)
  Q?: number         // slope control (default 0.707)
  fs?: number        // sample rate (default 44100)
  [key: string]: unknown
}

/** Low-shelf filter — boost or cut below corner frequency. fc default 200 Hz. */
export function lowShelf(data: Buf, params: ShelfParams): Buf
/** High-shelf filter — boost or cut above corner frequency. fc default 4000 Hz. */
export function highShelf(data: Buf, params: ShelfParams): Buf

export interface BaxandallParams {
  bass?: number      // dB (default 0)
  treble?: number    // dB (default 0)
  fBass?: number     // bass pivot Hz (default 250)
  fTreble?: number   // treble pivot Hz (default 4000)
  fs?: number
  [key: string]: unknown
}

/** Baxandall bass/treble tone control — cascaded low-shelf + high-shelf */
export function baxandall(data: Buf, params: BaxandallParams): Buf

export interface TiltParams {
  gain?: number      // dB: positive = bass up / treble down (default 0)
  pivot?: number     // pivot frequency Hz (default 1000)
  fs?: number
  [key: string]: unknown
}

/** Tilt EQ — see-saw around a pivot frequency */
export function tilt(data: Buf, params: TiltParams): Buf
