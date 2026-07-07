// audio-filter/auditory — TypeScript declarations

import type { Buf, SOS } from '../weighting/index.js'

export interface GammatoneParams {
  fc?: number        // center frequency Hz (default 1000)
  fs?: number        // sample rate (default 44100)
  order?: number     // filter order (default 4)
  [key: string]: unknown
}

/** Gammatone auditory filter — 4th-order cochlear model, in-place */
export function gammatone(data: Buf, params: GammatoneParams): Buf

export interface BankOpts {
  fmin?: number      // lowest band center Hz
  fmax?: number      // highest band center Hz
}

export interface ErbBankOpts extends BankOpts {
  density?: number   // bands per ERB (default 1)
}

export interface OctaveBand { fc: number; coefs: SOS }
export interface ErbBand    { fc: number; erb: number }
export interface BarkBand   { bark: number; fLow: number; fHigh: number; fc: number; coefs: SOS }

/** IEC 61260 fractional-octave filter bank. fraction default 3 (1/3-octave), fs default 44100, fmin/fmax default 31.25/16000 Hz */
export function octaveBank(fraction?: number, fs?: number, opts?: BankOpts): OctaveBand[]

/** ERB-spaced gammatone filter bank (Glasberg & Moore). fs default 44100, fmin/fmax default 50/min(16000, fs/2) Hz */
export function erbBank(fs?: number, opts?: ErbBankOpts): ErbBand[]

/** Bark-scale critical-band filter bank (Zwicker). fs default 44100, fmin/fmax default 20/min(15500, fs/2) Hz. A caller-supplied fmin below 20 Hz is honored as band 1's fLow instead of being clamped up. */
export function barkBank(fs?: number, opts?: BankOpts): BarkBand[]

export interface MelBankOpts extends BankOpts {
  nFilters?: number   // number of mel filters (default 26)
}

export interface MelBand { fc: number; fLow: number; fHigh: number; mel: number }

/** Mel-frequency triangular filter bank */
export function melBank(fs?: number, opts?: MelBankOpts): MelBand[]
