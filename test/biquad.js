// @audio/biquad — the audio-side RBJ kernel. Differential-verified against
// digital-filter (scijs design reference); note bandpass here = constant 0 dB
// peak (Web Audio convention) = digital-filter's bandpass2.
import test, { almost, ok, is } from 'tst'
import * as bq from '@audio/biquad'
import { lowpass as dfLowpass, highpass as dfHighpass, peaking as dfPeaking, bandpass2 as dfBandpass2 } from 'digital-filter/iir/biquad.js'
import dfFilter from 'digital-filter/core/filter.js'
import { rings } from './util.js'

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

test('biquad – cascade ≡ section-by-section process, bit for bit, any section count', () => {
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

test('biquad – a design given a section writes into it and returns it: the numbers of a new one, bit for bit', () => {
	for (let [f, args] of [['lowpass', [1000, 0.7, fs]], ['highpass', [80, 2, 48000]], ['bandpass', [3000, 9, fs]], ['notch', [60, 4, fs]],
		['allpass', [700, 0.5, fs]], ['peaking', [2000, 1.4, fs, -6]], ['lowshelf', [120, 0.707, 96000, 9]], ['highshelf', [9000, 0.707, fs, -3]]]) {
		let c = { b0: 0, b1: 0, b2: 0, a1: 0, a2: 0 }, fresh = bq[f](...args)
		let got = bq[f](...args, c)
		ok(got === c, `${f}: returns the section given`)
		ok(['b0', 'b1', 'b2', 'a1', 'a2'].every(k => Object.is(c[k], fresh[k])), `${f}: the numbers of a new section, bit for bit`)
	}
})

// tail() against the rule computed here directly: the impulse response run 2^21 frames through process(), its |h|
// summed from the end; the tail is the frames before the first frame from which that rest is under 1e-3, 0 at 128
// frames or under. Never fewer frames; a few more where the bound on the rest past what tail() sums adds to the sum
const direct = (sos, rate) => {
	let h = new Float64Array(1 << 21)
	h[0] = 1
	for (let c of [].concat(sos)) bq.process(h, c, bq.state())
	let rest = 0, k = h.length
	while (k > 0 && rest + Math.abs(h[k - 1]) <= 1e-3) rest += Math.abs(h[--k])
	return k - 1 <= 128 ? 0 : k - 1
}
test('biquad – tail(): the frames until the rest of Σ|h| is under 1e-3, as summed here over the whole response; never fewer, at most 5 % more', () => {
	let u = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(5), worst = 1, n = 0
	for (let i = 0; i < 240; i++) {
		let type = ['lowpass', 'highpass', 'bandpass', 'notch', 'allpass', 'peaking', 'lowshelf', 'highshelf'][i % 8], rate = [8000, 22050, 44100, 48000, 96000, 192000][i % 6]
		let fc = Math.min(0.49 * rate, 20 * 1000 ** u()), Q = 0.1 * 200 ** u(), dB = -24 + 48 * u()
		let one = /shelf|peaking/.test(type) ? bq[type](fc, Q, rate, dB) : bq[type](fc, Q, rate)
		let sos = i % 5 === 4 ? [one, bq.lowpass(Math.min(0.49 * rate, 100 + 5000 * u()), 0.3 + 5 * u(), rate), bq.highshelf(Math.min(0.49 * rate, 500 + 5000 * u()), 0.707, rate, -12 + 24 * u())] : one
		let T = Math.round(bq.tail(sos, rate) * rate), D = direct(sos, rate)
		if (D > 0) worst = Math.max(worst, T / D)
		n += T >= D && T <= Math.ceil(1.05 * D)
	}
	is(n, 240, `240 sections and cascades: tail() within [the rest summed here, 5 % over] (most ${worst.toFixed(4)})`)
})

// The rule against what sounds: the rings of a section (util.js rings: an impulse, noise, a DC step, tones about fc and
// over the spectrum, each to 60 dB under the input's level) never outlast it, and the longest comes within 1.5 of it
test('biquad – tail(): a lowpass, highpass or bandpass section never rings past it, and rings at least two thirds of it', () => {
	for (let rate of [44100, 96000]) for (let type of ['lowpass', 'highpass', 'bandpass']) for (let fc of [20, 100, 1000, 8000]) for (let Q of [0.1, 0.5, 0.707, 4, 20]) {
		let c = bq[type](fc, Q, rate), T = bq.tail(c, rate) * rate
		if (T > rate / 2) continue
		let r = rings(x => bq.process(x, c), T, { fs: rate, freqs: [fc * 0.9, fc * 0.95, fc, fc * 1.05, fc * 1.1, 10, 30, 100, 300, 1000, 3000, 10000] })
		ok(!r.short && r.over <= 1.5, `${type} ${fc} Hz Q ${Q} at ${rate}: ${T.toFixed(0)} frames; rings impulse ${r.impulse}, dc ${r.dc}, tone ${r.tone}, noise ${r.noise}`)
	}
})

test('biquad – tail(): an SOS array rings as its sections in series; Infinity on the unit circle; 0 with no poles or a ring under 128 frames', () => {
	let slow = bq.lowpass(50, 8, fs), fast = bq.allpass(5000, 0.707, fs)   // an allpass passes the slow ring on at its level
	ok(Math.abs(bq.tail([fast, slow], fs) - bq.tail(slow, fs)) * fs <= 0.01 * bq.tail(slow, fs) * fs, 'an allpass in series moves the ring by under 1 %')
	is(bq.tail({ b0: 1, b1: 0, b2: 0, a1: -2 * Math.cos(0.1), a2: 1 }, fs), Infinity, 'poles on the unit circle ring for ever')
	is(bq.tail({ b0: 0.5, b1: 0.5, b2: 0, a1: 0, a2: 0 }, fs), 0, 'an FIR section has no ring')
	// one real pole r, gain 1 − r: h = (1 − r)·rⁿ, and from frame N on its sum is r^N, under 1e-3 from N = ln(1000)/ln(1/r)
	for (let r of [0.99, 0.999, 0.9999]) {
		let N = Math.ceil(Math.log(1000) / Math.log(1 / r))
		is(Math.round(bq.tail({ b0: 1 - r, b1: 0, b2: 0, a1: -r, a2: 0 }, fs) * fs), N - 1 <= 128 ? 0 : N - 1, `one pole at ${r}: ${N - 1} frames`)
	}
})
