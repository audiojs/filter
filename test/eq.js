import test, { almost, ok, is } from 'tst'
import * as audio from '../index.js'
import { lowshelf, highshelf } from 'digital-filter/iir/biquad.js'
import { dftMag, magDB, impulse, dc, EPSILON, LOOSE } from './util.js'

// Complex per-band frequency response (SOS cascade), for verifying flat-sum
// crossover reconstruction — magDB() alone discards phase, which hides
// polarity-cancellation defects (e.g. LR2 without inversion).
function sosComplex (sos, f, fs) {
	let w = 2 * Math.PI * f / fs
	let re = 1, im = 0
	for (let c of sos) {
		let br = c.b0 + c.b1 * Math.cos(w) + c.b2 * Math.cos(2 * w)
		let bi = -(c.b1 * Math.sin(w) + c.b2 * Math.sin(2 * w))
		let ar = 1 + c.a1 * Math.cos(w) + c.a2 * Math.cos(2 * w)
		let ai = -(c.a1 * Math.sin(w) + c.a2 * Math.sin(2 * w))
		let denom = ar * ar + ai * ai
		let hr = (br * ar + bi * ai) / denom
		let hi = (bi * ar - br * ai) / denom
		let nr = re * hr - im * hi, ni = re * hi + im * hr
		re = nr; im = ni
	}
	return { re, im }
}

// Complex sum across bands (a true "sum the outputs" check, unlike summing magnitudes)
function sumBandsDB (bands, f, fs) {
	let re = 0, im = 0
	for (let sos of bands) {
		let h = sosComplex(sos, f, fs)
		re += h.re; im += h.im
	}
	return 10 * Math.log10(re * re + im * im)
}

test('graphicEq — applies gain', () => {
	let data = dc(512)
	audio.graphicEq(data, {gains: {1000: 6}, fs: 44100})
	// DC should still pass (peaking EQ at 1kHz doesn't affect DC)
	almost(data[511], 1, 0.05)
})

test('parametricEq — applies bands', () => {
	let data = dc(256)
	audio.parametricEq(data, {bands: [{fc: 1000, Q: 1, gain: 0, type: 'peak'}], fs: 44100})
	almost(data[255], 1, 0.01)
})

test('crossover — returns correct band count', () => {
	let bands = audio.crossover([500, 2000], 4, 44100)
	is(bands.length, 3, '2 crossover freqs → 3 bands')
	ok(Array.isArray(bands[0]), 'each band is SOS array')
})

test('crossfeed — mixes stereo channels', () => {
	let left = dc(256, 1)
	let right = dc(256, 0)
	audio.crossfeed(left, right, {fc: 700, level: 0.3, fs: 44100})
	// Right channel should now have some energy (mixed from left)
	let rightEnergy = 0
	for (let i = 128; i < 256; i++) rightEnergy += right[i] * right[i]
	ok(rightEnergy > 0.01, 'crossfeed mixes L→R (right energy: ' + rightEnergy.toFixed(4) + ')')
	// Left should still have energy (not fully cancelled)
	let leftEnergy = 0
	for (let i = 128; i < 256; i++) leftEnergy += left[i] * left[i]
	ok(leftEnergy > 0.1, 'left retains energy after crossfeed')
})

test('graphicEq — gains:{1000:6} boosts 1kHz', () => {
	let fs = 44100, N = 4096
	let data = new Float64Array(N)
	for (let i = 0; i < N; i++) data[i] = Math.sin(2 * Math.PI * 1000 * i / fs)
	audio.graphicEq(data, { gains: { 1000: 6 }, fs })
	let peak = 0
	for (let i = N / 2; i < N; i++) if (Math.abs(data[i]) > peak) peak = Math.abs(data[i])
	ok(peak > 1.5, `graphicEq 1kHz boosted: peak ${peak.toFixed(3)}`)
})

test('parametricEq — gain:6 at 1kHz boosts signal', () => {
	let fs = 44100, N = 4096
	let data = new Float64Array(N)
	for (let i = 0; i < N; i++) data[i] = Math.sin(2 * Math.PI * 1000 * i / fs)
	audio.parametricEq(data, { bands: [{ fc: 1000, Q: 1, gain: 6, type: 'peak' }], fs })
	let peak = 0
	for (let i = N / 2; i < N; i++) if (Math.abs(data[i]) > peak) peak = Math.abs(data[i])
	ok(peak > 1.5, `parametricEq boosted 1kHz: peak ${peak.toFixed(3)}`)
})

test('crossover LR4 — allpass property', () => {
	let fs = 44100, fc = 2000
	let bands = audio.crossover([fc], 4, fs)
	is(bands.length, 2, 'single crossover = 2 bands')
	for (let f of [200, 1000, 2000, 4000, 8000]) {
		let lpLin = Math.pow(10, magDB(bands[0], f, fs) / 20)
		let hpLin = Math.pow(10, magDB(bands[1], f, fs) / 20)
		let sumDB = 20 * Math.log10(lpLin + hpLin)
		ok(Math.abs(sumDB) < 1.0, `crossover@${f}Hz: sum=${sumDB.toFixed(2)}dB`)
	}
})

test('crossfeed — level=0 is passthrough', () => {
	let N = 256
	let left = dc(N, 0.7), right = dc(N, -0.3)
	let origL = Float64Array.from(left), origR = Float64Array.from(right)
	audio.crossfeed(left, right, { fc: 700, level: 0, fs: 44100 })
	let maxErrL = 0, maxErrR = 0
	for (let i = 0; i < N; i++) {
		if (Math.abs(left[i] - origL[i]) > maxErrL) maxErrL = Math.abs(left[i] - origL[i])
		if (Math.abs(right[i] - origR[i]) > maxErrR) maxErrR = Math.abs(right[i] - origR[i])
	}
	ok(maxErrL < LOOSE, `left passthrough err=${maxErrL.toFixed(8)}`)
	ok(maxErrR < LOOSE, `right passthrough err=${maxErrR.toFixed(8)}`)
})

test('lowShelf — boosts bass', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.lowShelf(data, { fc: 300, gain: 6, fs })
	let mag100 = dftMag(data, 100, fs)
	let mag5k = dftMag(data, 5000, fs)
	ok(mag100 > mag5k * 1.5, `lowShelf +6dB: 100Hz (${mag100.toFixed(3)}) > 5kHz (${mag5k.toFixed(3)})`)
})

test('highShelf — boosts treble', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.highShelf(data, { fc: 4000, gain: 6, fs })
	let mag10k = dftMag(data, 10000, fs)
	let mag200 = dftMag(data, 200, fs)
	ok(mag10k > mag200 * 1.5, `highShelf +6dB: 10kHz (${mag10k.toFixed(3)}) > 200Hz (${mag200.toFixed(3)})`)
})

test('lowShelf — gain=0 is passthrough', () => {
	let data = impulse(256)
	let orig = Float64Array.from(data)
	audio.lowShelf(data, { fc: 300, gain: 0, fs: 44100 })
	let maxErr = 0
	for (let i = 0; i < data.length; i++) { let err = Math.abs(data[i] - orig[i]); if (err > maxErr) maxErr = err }
	ok(maxErr < EPSILON, `lowShelf gain=0 passthrough: err=${maxErr}`)
})

test('baxandall — bass boost, treble flat', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.baxandall(data, { bass: 6, treble: 0, fs })
	let mag100 = dftMag(data, 100, fs)
	let mag10k = dftMag(data, 10000, fs)
	ok(mag100 > mag10k * 1.3, `baxandall bass+6: 100Hz (${mag100.toFixed(3)}) > 10kHz (${mag10k.toFixed(3)})`)
})

test('baxandall — treble boost, bass flat', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.baxandall(data, { bass: 0, treble: 6, fs })
	let mag10k = dftMag(data, 10000, fs)
	let mag100 = dftMag(data, 100, fs)
	ok(mag10k > mag100 * 1.3, `baxandall treble+6: 10kHz (${mag10k.toFixed(3)}) > 100Hz (${mag100.toFixed(3)})`)
})

test('baxandall — both=0 is passthrough', () => {
	let data = impulse(256)
	let orig = Float64Array.from(data)
	audio.baxandall(data, { bass: 0, treble: 0, fs: 44100 })
	let maxErr = 0
	for (let i = 0; i < data.length; i++) { let err = Math.abs(data[i] - orig[i]); if (err > maxErr) maxErr = err }
	ok(maxErr < EPSILON, `baxandall 0/0 passthrough: err=${maxErr}`)
})

test('tilt — positive tilts bass up, treble down', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.tilt(data, { gain: 6, pivot: 1000, fs })
	let mag100 = dftMag(data, 100, fs)
	let mag10k = dftMag(data, 10000, fs)
	ok(mag100 > mag10k, `tilt +6: 100Hz (${mag100.toFixed(3)}) > 10kHz (${mag10k.toFixed(3)})`)
})

test('tilt — negative tilts treble up, bass down', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.tilt(data, { gain: -6, pivot: 1000, fs })
	let mag10k = dftMag(data, 10000, fs)
	let mag100 = dftMag(data, 100, fs)
	ok(mag10k > mag100, `tilt -6: 10kHz (${mag10k.toFixed(3)}) > 100Hz (${mag100.toFixed(3)})`)
})

test('tilt — gain=0 is passthrough', () => {
	let data = impulse(256)
	let orig = Float64Array.from(data)
	audio.tilt(data, { gain: 0, pivot: 1000, fs: 44100 })
	let maxErr = 0
	for (let i = 0; i < data.length; i++) { let err = Math.abs(data[i] - orig[i]); if (err > maxErr) maxErr = err }
	ok(maxErr < EPSILON, `tilt gain=0 passthrough: err=${maxErr}`)
})

test('tilt — pivot stays at exactly 0dB for any gain', () => {
	// tilt cascades lowshelf(pivot,0.5,fs,gain) with highshelf(pivot,0.5,fs,-gain)
	// (eq/tilt.js). RBJ's shelf equations give both filters the same magnitude at
	// their own corner frequency independent of gain, so the +gain/-gain pair
	// cancels there exactly. Robert Bristow-Johnson, "Audio EQ Cookbook", shelf design.
	let fs = 44100, pivot = 1000
	for (let gain of [3, 6, -6, 18, -24]) {
		let lo = [lowshelf(pivot, 0.5, fs, gain)]
		let hi = [highshelf(pivot, 0.5, fs, -gain)]
		let db = magDB(lo, pivot, fs) + magDB(hi, pivot, fs)
		almost(db, 0, 1e-9, `tilt gain=${gain}: pivot=${db}dB`)
	}
})

test('baxandall — DC/Nyquist gains match RBJ shelf analytic values exactly', () => {
	// baxandall cascades lowshelf(fBass,...,bass) with highshelf(fTreble,...,treble).
	// RBJ cookbook: lowshelf DC gain = dBgain, Nyquist gain = 0; highshelf DC gain = 0,
	// Nyquist gain = dBgain. Cascaded: DC = bass dB exactly, Nyquist = treble dB exactly.
	let fs = 44100, fBass = 250, fTreble = 4000
	for (let [bass, treble] of [[6, 0], [0, 6], [6, -4], [-9, 12]]) {
		let b = [lowshelf(fBass, 0.707, fs, bass)]
		let t = [highshelf(fTreble, 0.707, fs, treble)]
		let dc = magDB(b, 0, fs) + magDB(t, 0, fs)
		let nyq = magDB(b, fs / 2, fs) + magDB(t, fs / 2, fs)
		almost(dc, bass, 1e-9, `baxandall DC gain (bass=${bass}): ${dc}dB`)
		almost(nyq, treble, 1e-9, `baxandall Nyquist gain (treble=${treble}): ${nyq}dB`)
	}
})

test('crossover — LR2 sums flat with polarity inversion (Linkwitz-Riley 1976)', () => {
	// order=2 (order/2=1, odd) requires inverting alternate bands to sum flat —
	// Linkwitz, S. & Riley, R., "Active Crossover Networks for Noncoincident
	// Drivers", JAES 24(1), 1976. Without inversion this is a ~-60dB notch at fc.
	let fs = 44100, fc = 1000
	let bands = audio.crossover([fc], 2, fs)
	for (let f of [100, 500, 900, 999, 1000, 1001, 1100, 5000, 15000]) {
		almost(sumBandsDB(bands, f, fs), 0, 0.01, `LR2 sum@${f}Hz`)
	}
})

test('crossover — LR8 sums flat without inversion (order/2 even)', () => {
	let fs = 44100, fc = 1000
	let bands = audio.crossover([fc], 8, fs)
	for (let f of [100, 500, 900, 999, 1000, 1001, 1100, 5000, 15000]) {
		almost(sumBandsDB(bands, f, fs), 0, 0.01, `LR8 sum@${f}Hz`)
	}
})

test('crossover — LR4 sums flat (regression, complex-domain check)', () => {
	let fs = 44100, fc = 2000
	let bands = audio.crossover([fc], 4, fs)
	for (let f of [200, 1000, 2000, 4000, 8000]) {
		almost(sumBandsDB(bands, f, fs), 0, 0.01, `LR4 sum@${f}Hz`)
	}
})

test('graphicEq — ISO 266 nominal keys (31.5, 63) build filters', () => {
	// ISO 266:1997 / IEC 61260-1 1/1-octave nominal center frequencies — the low end
	// (31.5, 63) diverges from exact-octave 1000*2^k (31.25, 62.5); readme claims
	// ISO 266 so these exact nominal keys must resolve, not just 1000/2000/...
	let p = { gains: { 31.5: -12, 63: 6 }, fs: 44100 }
	audio.graphicEq(dc(64, 1), p)
	is(p._filters.length, 2, 'both ISO nominal keys (31.5, 63) built a filter')
})

test('graphicEq — recomputes filters when gains mutated in place', () => {
	let p = { gains: { 1000: 6 }, fs: 44100 }
	audio.graphicEq(dc(64, 1), p)
	let before = JSON.stringify(p._filters)
	p.gains[1000] = 12
	audio.graphicEq(dc(64, 1), p)
	let after = JSON.stringify(p._filters)
	ok(before !== after, 'gains mutation triggers coefficient rebuild')
})

test('graphicEq — recomputes filters when fs changes on reused params', () => {
	let p = { gains: { 1000: 6 }, fs: 44100 }
	audio.graphicEq(dc(64, 1), p)
	let before = JSON.stringify(p._filters)
	p.fs = 96000
	audio.graphicEq(dc(64, 1), p)
	let after = JSON.stringify(p._filters)
	ok(before !== after, 'fs mutation triggers coefficient rebuild')
})

test('parametricEq — recomputes filters when band content mutated in place', () => {
	let p = { bands: [{ fc: 1000, Q: 1, gain: 6, type: 'peak' }], fs: 44100 }
	audio.parametricEq(dc(64, 1), p)
	let before = JSON.stringify(p._filters)
	p.bands[0].gain = 12
	audio.parametricEq(dc(64, 1), p)
	let after = JSON.stringify(p._filters)
	ok(before !== after, 'band.gain mutation triggers filter rebuild (no _dirty flag needed)')
})

test('parametricEq — lowshelf/highshelf bands default to Q=0.707 (matches standalone filters)', () => {
	// eq/lowshelf.js / eq/highshelf.js default Q to 0.707 (RBJ maximally-flat shelf);
	// parametricEq must match so the same nominal band gives the same curve regardless
	// of entry point.
	let fs = 44100, fc = 300, gain = 6
	let peqData = impulse(4096)
	audio.parametricEq(peqData, { bands: [{ fc, gain, type: 'lowshelf' }], fs })
	let stdData = impulse(4096)
	audio.lowShelf(stdData, { fc, gain, fs })
	let f = 100
	almost(dftMag(peqData, f, fs), dftMag(stdData, f, fs), 1e-9, 'lowshelf band matches standalone lowShelf')

	let peqHi = impulse(4096)
	audio.parametricEq(peqHi, { bands: [{ fc: 4000, gain, type: 'highshelf' }], fs })
	let stdHi = impulse(4096)
	audio.highShelf(stdHi, { fc: 4000, gain, fs })
	almost(dftMag(peqHi, 10000, fs), dftMag(stdHi, 10000, fs), 1e-9, 'highshelf band matches standalone highShelf')
})

test('crossfeed — mono content stays near unity gain across level range (Bauer/BS2B)', () => {
	// Bauer (1961) / BS2B: direct+cross gain sums to unity so correlated/mono content
	// isn't boosted. Below fc the lowpass crossfeed term is ~unity, so a mono tone
	// well below fc should measure ~0dB regardless of level.
	let fs = 44100, N = 4096, fc = 700, freq = 50
	for (let level of [0.3, 0.5, 0.7]) {
		let left = new Float64Array(N), right = new Float64Array(N)
		for (let i = 0; i < N; i++) left[i] = right[i] = Math.sin(2 * Math.PI * freq * i / fs)
		audio.crossfeed(left, right, { fc, level, fs })
		let peak = 0
		for (let i = 3 * N / 4; i < N; i++) if (Math.abs(left[i]) > peak) peak = Math.abs(left[i])
		let db = 20 * Math.log10(peak)
		ok(Math.abs(db) < 0.5, `crossfeed level=${level}: mono gain=${db.toFixed(3)}dB`)
	}
})

test('crossfeed — recomputes coefficients when fc/fs/level change on reused params', () => {
	let p = { fc: 200, level: 0.3, fs: 44100 }
	audio.crossfeed(dc(64, 1), dc(64, 0), p)
	let before = JSON.stringify(p._coefs)
	p.fc = 5000
	audio.crossfeed(dc(64, 1), dc(64, 0), p)
	let after = JSON.stringify(p._coefs)
	ok(before !== after, 'fc mutation triggers coefficient rebuild')
})
