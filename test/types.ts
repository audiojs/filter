// Type-level lock: every documented subpath + root import, exercised against its
// real public signature. Run via `npm run test:types`. Not part of the runtime
// test suite (test.js) — this file is never executed, only type-checked.

import * as root from 'audio-filter'

import { aWeighting, cWeighting, kWeighting, itu468, riaa } from 'audio-filter/weighting'
import type { SOS, BiquadCoef } from 'audio-filter/weighting'

import { gammatone, octaveBank, erbBank, barkBank, melBank } from 'audio-filter/auditory'
import type { ErbBand, BarkBand, OctaveBand, MelBand } from 'audio-filter/auditory'

import { moogLadder, diodeLadder, korg35, oberheim } from 'audio-filter/analog'

import { formant, vocoder, lpcAnalysis, lpcSynthesize } from 'audio-filter/speech'

import { graphicEq, parametricEq, crossover, crossfeed, lowShelf, highShelf, baxandall, tilt } from 'audio-filter/eq'

import {
	dcBlocker, comb, allpass, emphasis, deemphasis, resonator, pinkNoise,
	spectralTilt, variableBandwidth, notch, highpass, lowpass, bandpass
} from 'audio-filter/effect'

let buf = new Float64Array(64)

// ---------------------------------------------------------------------------
// weighting
// ---------------------------------------------------------------------------

aWeighting(buf)
aWeighting(buf, { fs: 48000 })
let wsos: SOS = aWeighting.coefs(48000)
let wcoef: BiquadCoef = wsos[0]
cWeighting(buf, {})
kWeighting(buf, { fs: 48000 })
itu468(buf)
riaa(buf)

// ---------------------------------------------------------------------------
// auditory
// ---------------------------------------------------------------------------

gammatone(buf, { fc: 1000, fs: 44100, order: 4 })
let obands: OctaveBand[] = octaveBank(3, 44100, { fmin: 31.25, fmax: 16000 })
obands[0].coefs[0].b0

let ebands: ErbBand[] = erbBank(44100, { fmin: 50, fmax: 16000, density: 1 })
ebands[0].fc
ebands[0].erb
// @ts-expect-error — bw was removed from ErbBand (dead duplicate of erb)
ebands[0].bw

let bbands: BarkBand[] = barkBank(44100, { fmin: 20, fmax: 15500 })
bbands[0].bark
bbands[0].fLow
bbands[0].fHigh
bbands[0].fc
bbands[0].coefs

let mbands: MelBand[] = melBank(44100, { fmin: 0, fmax: 8000, nFilters: 26 })
mbands[0].mel

// octaveBank/fraction defaults to 3 — no-arg call must type-check
octaveBank()

// ---------------------------------------------------------------------------
// analog
// ---------------------------------------------------------------------------

moogLadder(buf, { fc: 1000, resonance: 0.5, fs: 44100, drive: 1 })
diodeLadder(buf, { fc: 1000, resonance: 0.5, drive: 2 })
korg35(buf, { fc: 1000, resonance: 0.5, drive: 1, type: 'highpass' })
oberheim(buf, { fc: 1000, resonance: 0.5, type: 'bandpass' })
// note: OberheimParams carries no `drive` field (unlike LadderParams/Korg35Params) — oberheim.js never
// reads params.drive. Not enforceable as a @ts-expect-error here since OberheimParams' `[key: string]:
// unknown` catch-all (needed for internal _-prefixed state) also accepts stray `drive` silently.

// ---------------------------------------------------------------------------
// speech
// ---------------------------------------------------------------------------

formant(buf, { fs: 44100, formants: [{ fc: 730, bw: 90, gain: 1 }] })
let vout: Float64Array = vocoder(buf, buf, { bands: 8, fmin: 100, fmax: 8000, fs: 44100 })

let lpc = lpcAnalysis(buf, { order: 12 })
let lpcCoefs: Float64Array = lpc.coefs
let lpcGain: number = lpc.gain
let lpcResidual: Float64Array = lpc.residual
// @ts-expect-error — lpcAnalysis requires params (params.order is dereferenced unconditionally)
lpcAnalysis(buf)
// note: `fs` was dropped from LpcParams (lpc.js never reads params.fs) — passing it still type-checks
// only because of LpcParams' `[key: string]: unknown` catch-all, not because `fs` is a declared field.

lpcSynthesize(buf, { coefs: lpc.coefs, gain: lpc.gain })
lpcSynthesize(buf, { coefs: lpc.coefs }) // gain is optional, defaults to 1

// ---------------------------------------------------------------------------
// eq
// ---------------------------------------------------------------------------

graphicEq(buf, { gains: { 31.5: 3, 63: 2, 125: 1, 250: 0, 500: -1, 1000: 2, 2000: 0, 4000: -2, 8000: 1, 16000: 3 }, fs: 44100 })
parametricEq(buf, { bands: [{ fc: 1000, Q: 1, gain: 3, type: 'peak' }, { fc: 200, type: 'lowshelf' }], fs: 44100 })
// @ts-expect-error — gain is optional (defaults to 0), but type must be one of the literal union
parametricEq(buf, { bands: [{ fc: 1000, type: 'invalid' }] })

let csos: SOS[] = crossover([500, 5000], 4, 44100)
crossover([500, 5000]) // order/fs both optional, default to 4/44100

let left = new Float64Array(64), right = new Float64Array(64)
let cf: { left: Float64Array | Float32Array | number[], right: Float64Array | Float32Array | number[] } = crossfeed(left, right, { fc: 700, level: 0.3 })

lowShelf(buf, { gain: 3 }) // fc optional, defaults to 200
highShelf(buf, { gain: -3 }) // fc optional, defaults to 4000
baxandall(buf, { bass: 3, treble: -2, fBass: 250, fTreble: 4000 })
tilt(buf, { gain: 2, pivot: 1000 })

// ---------------------------------------------------------------------------
// effect
// ---------------------------------------------------------------------------

dcBlocker(buf)
dcBlocker(buf, { R: 0.995 })
comb(buf, { delay: 100, gain: 0.5, type: 'feedback' })
allpass.first(buf, { a: 0.5 })
allpass.second(buf, { fc: 1000, Q: 0.707 })
emphasis(buf, { alpha: 0.97 })
deemphasis(buf)
resonator(buf, { fc: 440, bw: 50 })
// @ts-expect-error — resonator.js throws 'params.fc is required'
resonator(buf, {})
pinkNoise(buf)
spectralTilt(buf, { slope: 3 })
variableBandwidth(buf, { fc: 1000, Q: 2, type: 'bandpass' })
notch(buf, { fc: 1000, Q: 30 })
// @ts-expect-error — notch.js throws 'params.fc is required'
notch(buf, {})

lowpass(buf, { fc: 1000, order: 2 })
// @ts-expect-error — lowpass.js throws 'params.fc is required'
lowpass(buf, { order: 2 })
highpass(buf, { fc: 1000 })
// @ts-expect-error — highpass.js throws 'params.fc is required'
highpass(buf, {})
bandpass(buf, { fc: 1000, Q: 0.707 })
// @ts-expect-error — bandpass.js throws 'params.fc is required'
bandpass(buf, {})

lowpass.useButterworth((order, fc, fs, type) => [{ b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }])
highpass.useButterworth((order, fc, fs, type) => [{ b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }])

// ---------------------------------------------------------------------------
// root re-exports every domain's exports
// ---------------------------------------------------------------------------

root.aWeighting(buf)
root.gammatone(buf, { fc: 1000 })
root.moogLadder(buf, { fc: 1000 })
root.formant(buf, {})
root.graphicEq(buf, {})
root.lowpass(buf, { fc: 1000 })
root.lowpass.useButterworth((order, fc, fs, type) => [])
let rootSOS: root.SOS = []
