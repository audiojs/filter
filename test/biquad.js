// @audio/biquad — the audio-side RBJ kernel. Differential-verified against
// digital-filter (scijs design reference); note bandpass here = constant 0 dB
// peak (Web Audio convention) = digital-filter's bandpass2.
import test, { almost, ok } from 'tst'
import * as bq from '@audio/biquad'
import { lowpass as dfLowpass, highpass as dfHighpass, peaking as dfPeaking, bandpass2 as dfBandpass2 } from 'digital-filter/iir/biquad.js'
import dfFilter from 'digital-filter/core/filter.js'

const fs = 44100

function sine (f, n) {
	let d = new Float32Array(n)
	for (let i = 0; i < n; i++) d[i] = Math.sin(2 * Math.PI * f * i / fs)
	return d
}
function maxDiff (a, b) {
	let m = 0
	for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]))
	return m
}

test('biquad — differential vs digital-filter (scijs reference) <1e-9', () => {
	for (let [mine, ref, args] of [
		[bq.lowpass, dfLowpass, [1000, 0.707, fs]],
		[bq.highpass, dfHighpass, [500, 1.2, fs]],
		[bq.bandpass, dfBandpass2, [1500, 2, fs]],
	]) {
		let a = mine(...args), b = ref(...args)
		for (let k of ['b0', 'b1', 'b2', 'a1', 'a2']) almost(a[k], b[k], 1e-9, `${k}`)
	}
	let p = bq.peaking(2000, 1, fs, 6), pr = dfPeaking(2000, 1, fs, 6)
	for (let k of ['b0', 'b1', 'b2', 'a1', 'a2']) almost(p[k], pr[k], 1e-9)
})

test('biquad — magnitude responses honor the spec', () => {
	let lp = bq.lowpass(1000, Math.SQRT1_2, fs)
	almost(bq.magnitude(lp, 1000, fs), Math.SQRT1_2, 0.01, '−3 dB at cutoff')
	ok(bq.magnitude(lp, 100, fs) > 0.99, 'passband flat')
	ok(bq.magnitude(lp, 10000, fs) < 0.02, 'stopband −34 dB+')
	let pk = bq.peaking(2000, 1, fs, 6)
	almost(20 * Math.log10(bq.magnitude(pk, 2000, fs)), 6, 0.05, '+6 dB at center')
	let ap = bq.allpass(3000, 0.707, fs)
	almost(bq.magnitude(ap, 500, fs), 1, 1e-6)
	almost(bq.magnitude(ap, 8000, fs), 1, 1e-6)
	almost(bq.magnitude(bq.bandpass(1500, 2, fs), 1500, fs), 1, 0.01, 'bandpass 0 dB peak')
})

test('biquad — cascadeMagnitude ≡ product of per-section magnitude', () => {
	let sos = [bq.lowpass(2000, 0.707, fs), bq.peaking(500, 1, fs, 6), bq.highpass(80, 0.707, fs)]
	for (let f of [100, 500, 2000, 8000]) {
		let expected = sos.reduce((m, c) => m * bq.magnitude(c, f, fs), 1)
		almost(bq.cascadeMagnitude(sos, f, fs), expected, 1e-12, `f=${f}`)
	}
	almost(bq.cascadeMagnitude([], 1000, fs), 1, 1e-12, 'empty cascade ⇒ unity')
})

test('biquad — stateful chunked processing ≡ one pass', () => {
	let c = bq.lowpass(2000, 0.707, fs)
	let x = sine(440, 8192)
	let whole = bq.process(Float32Array.from(x), c)
	let chunked = Float32Array.from(x)
	let s = bq.state()
	for (let pos = 0; pos < chunked.length; pos += 555) bq.process(chunked.subarray(pos, Math.min(pos + 555, chunked.length)), c, s)
	ok(maxDiff(whole, chunked) < 1e-12, 'state carries across chunks')
})

test('biquad — step ≡ process, sample for sample', () => {
	let c = bq.highpass(800, 1, fs)
	let x = sine(220, 2048)
	let viaProcess = bq.process(Float64Array.from(x), c)
	let s = bq.state(), viaStep = new Float64Array(x.length)
	for (let i = 0; i < x.length; i++) viaStep[i] = bq.step(c, s, x[i])
	ok(maxDiff(viaProcess, viaStep) === 0, 'identical recurrence')
})

test('biquad — cascade ≡ section-by-section process, bit for bit, any section count', () => {
	let all = [bq.lowpass(1200, 0.707, fs), bq.highpass(80, 0.707, fs), bq.peaking(2000, 1, fs, 6), bq.highshelf(4000, 0.707, fs, -3), bq.notch(60, 4, fs)]
	for (let Arr of [Float32Array, Float64Array]) for (let n = 1; n <= all.length; n++) {
		let sos = all.slice(0, n), x = Arr.from(sine(440, 3000), (v, i) => v + Math.sin(i * 1.3) * 0.3)
		let ref = Arr.from(x), rs = sos.map(() => bq.state())
		for (let i = 0; i < n; i++) bq.process(ref, sos[i], rs[i])
		let out = Arr.from(x), st = sos.map(() => bq.state())
		for (let pos = 0; pos < out.length; pos += 777) bq.cascade(out.subarray(pos, Math.min(pos + 777, out.length)), sos, st)
		let same = ref.every((v, i) => Object.is(v, out[i]))
		ok(same && st.every((s, i) => s[0] === rs[i][0] && s[1] === rs[i][1]), `${Arr.name} ${n} section(s): output and state identical`)
	}
})

test('biquad — filter(params) ≡ digital-filter kernel, state persists', () => {
	let coefs = [bq.lowpass(1200, 0.707, fs), bq.highpass(80, 0.707, fs)]
	let x = sine(440, 4096)
	let ref = dfFilter(Float64Array.from(x), { coefs })
	let p = { coefs }
	let out = Float64Array.from(x)
	for (let pos = 0; pos < out.length; pos += 700) bq.filter(out.subarray(pos, Math.min(pos + 700, out.length)), p)
	ok(maxDiff(ref, out) < 1e-12, 'chunked params kernel matches reference one-pass')
	ok(Array.isArray(p.state) && p.state.length === 2, 'state persisted on params')
	let threw = false
	try { bq.filter(out, { coefs: { b: [1], a: [1] } }) } catch { threw = true }
	ok(threw, 'fails fast on non-SOS coefs')
})
