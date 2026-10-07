// Type-level lock: every export of the umbrella against its public signature. Run via `npm run test:types`; never
// executed, only type-checked.

import {
	moogLadder, diodeLadder, korg35, oberheim, dcBlocker, comb, allpass, emphasis, deemphasis, derivative, integral,
	resonator, spectralTilt, variableBandwidth, highpass, lowpass, bandpass, notch,
} from '../index.js'
import type { SOS, BiquadCoef, MoogLadderParams } from '../index.js'

let buf = new Float64Array(64)

moogLadder(buf, { fc: 1000, resonance: 0.5 })
moogLadder(buf, { fc: 300, type: 'highpass', poles: 2 })
let mp: MoogLadderParams = { type: 'bandpass', poles: 4 }
moogLadder(buf, mp)
// @ts-expect-error — no such mode
moogLadder(buf, { type: 'notch' })
// @ts-expect-error — 2 or 4 poles
moogLadder(buf, { poles: 3 })
diodeLadder(buf, { fc: 500, resonance: 0.8 })
korg35(buf, { fc: 800, type: 'highpass' })
oberheim(buf, { fc: 1000, type: 'notch' })

dcBlocker(buf)
dcBlocker(buf, { R: 0.99 })
comb(buf, { delay: 10, gain: 0.5, type: 'feedback' })
allpass.first(buf, { a: 0.5 })
allpass.second(buf, { fc: 1000, Q: 1 })
emphasis(buf, { alpha: 0.97 })
deemphasis(buf)
derivative(buf)
integral(buf, { leak: 0.999 })
resonator(buf, { fc: 440, bw: 20 })
spectralTilt(buf, { slope: -3 })
variableBandwidth(buf, { fc: 1000, type: 'bandpass' })

highpass(buf, { fc: 80, order: 4 })
lowpass(buf, { fc: 1000 })
lowpass.useButterworth((order: number, fc: number, fs: number, type: 'lowpass' | 'highpass'): SOS => [])
bandpass(buf, { fc: 1000, Q: 2 })
notch(buf, { fc: 60, Q: 30 })
// @ts-expect-error — fc is required
notch(buf, {})

let coef: BiquadCoef = { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }
let sos: SOS = [coef]
