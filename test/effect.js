import test, { almost, ok } from 'tst'
import * as audio from '../index.js'
import butterworth from 'digital-filter/iir/butterworth.js'
import { dftMag, magDB, impulse, dc, EPSILON } from './util.js'
audio.highpass.useButterworth(butterworth)
audio.lowpass.useButterworth(butterworth)

test('dcBlocker — removes DC', () => {
	let data = dc(2048)
	audio.dcBlocker(data, {R: 0.995})
	ok(Math.abs(data[2047]) < 0.01, 'DC removed after settling')
})

test('comb feedforward — echo at delay', () => {
	let data = impulse(8)
	audio.comb(data, {delay: 3, gain: 0.5, type: 'feedforward'})
	almost(data[0], 1, EPSILON)
	almost(data[3], 0.5, EPSILON)
	almost(data[1], 0, EPSILON)
})

test('comb feedback — decaying echoes', () => {
	let data = impulse(10)
	audio.comb(data, {delay: 3, gain: 0.5, type: 'feedback'})
	almost(data[0], 1, EPSILON)
	almost(data[3], 0.5, EPSILON)
	almost(data[6], 0.25, EPSILON)
})

test('allpass.first — unity magnitude', () => {
	let data = [1, 0, 0, 0, 0, 0, 0, 0]
	audio.allpass.first(data, {a: 0.5})
	let energy = 0
	for (let i = 0; i < data.length; i++) energy += data[i] * data[i]
	ok(energy > 0, 'produces output')
})

test('pre-emphasis — boosts high frequencies', () => {
	let data = [0, 0, 0, 1, 0, 0, 0, 0]
	audio.emphasis(data, {alpha: 0.97})
	almost(data[3], 1, EPSILON)
	almost(data[4], -0.97, EPSILON)
})

test('de-emphasis — lowpass accumulation', () => {
	let data = impulse(8)
	audio.deemphasis(data, {alpha: 0.97})
	ok(data[0] > 0, 'first sample non-zero')
	ok(data[1] > 0, 'decaying tail')
	ok(data[1] < data[0], 'decreasing')
})

test('resonator — rings on impulse', () => {
	let data = impulse(256)
	audio.resonator(data, {fc: 1000, bw: 50, fs: 44100})
	// Constant-peak-gain normalization keeps impulse-response amplitude small
	// (unity gain is a frequency-domain, not time-domain, property) — assert
	// oscillation via sign, not a fixed absolute-amplitude threshold
	let hasPositive = false, hasNegative = false
	for (let i = 0; i < 256; i++) {
		if (data[i] > 0) hasPositive = true
		if (data[i] < 0) hasNegative = true
	}
	ok(hasPositive && hasNegative, 'resonator oscillates')
})

test('spectralTilt — nonzero output', () => {
	let data = impulse(256)
	audio.spectralTilt(data, {slope: 3, fs: 44100})
	ok(data.some(x => Math.abs(x) > 0.001), 'output present')
})

test('variableBandwidth — filters signal', () => {
	let data = dc(256)
	audio.variableBandwidth(data, {fc: 5000, Q: 0.707, fs: 44100})
	almost(data[255], 1, 0.05)
})

test('dcBlocker — output converges to 0 for pure DC', () => {
	let data = dc(4096)
	audio.dcBlocker(data, {R: 0.995})
	ok(Math.abs(data[4095]) < 0.005, 'DC blocked to < 0.005 (got ' + Math.abs(data[4095]).toFixed(6) + ')')
})

test('allpass.second — unity magnitude across spectrum', () => {
	let data = impulse(512)
	audio.allpass.second(data, {fc: 2000, Q: 1, fs: 44100})
	// Compute energy — should equal input energy (1.0 for unit impulse)
	let energy = 0
	for (let i = 0; i < data.length; i++) energy += data[i] * data[i]
	almost(energy, 1, 0.01)
})

// A moving fc (automation, a slider) replaces the coefficients; the transposed-DF-II state carries on, as in the
// Web Audio BiquadFilterNode. A reset per change restarted the filter at every block. Reference: the kernel over
// the whole signal with the same coefficient schedule, one state.
test('allpass.second: a moving fc keeps the state, equal to one continuous kernel', async () => {
	let { allpass, process, state } = await import('@audio/biquad')
	let fs = 44100, n = 8192, B = 128, p = {}, s = state(), max = 0
	let x = new Float64Array(n).map((_, i) => 0.5 * Math.sin(2 * Math.PI * 440 * i / fs)), y = Float64Array.from(x), ref = Float64Array.from(x)
	for (let i = 0; i < n; i += B) {
		let fc = 500 + 2000 * i / n
		Object.assign(p, { fc, Q: 0.707, fs })
		audio.allpass.second(y.subarray(i, i + B), p)
		process(ref.subarray(i, i + B), allpass(fc, 0.707, fs), s)
	}
	for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(y[i] - ref[i]))
	ok(max < 1e-12, `max |Δ| ${max.toExponential(1)}`)
})

test('emphasis + deemphasis round-trip = identity', () => {
	// deemphasis is the exact linear inverse of emphasis (1/(1-az⁻¹) undoes (1-az⁻¹));
	// float64 round-trip error is machine-epsilon-scale (~1e-16), not just "small"
	let N = 512, fs = 44100
	let orig = new Float64Array(N)
	for (let i = 0; i < N; i++) orig[i] = Math.sin(2 * Math.PI * 440 * i / fs)
	let data = Float64Array.from(orig)
	audio.emphasis(data, { alpha: 0.97 })
	audio.deemphasis(data, { alpha: 0.97 })
	let maxErr = 0
	for (let i = 100; i < N; i++) {
		let err = Math.abs(data[i] - orig[i])
		if (err > maxErr) maxErr = err
	}
	ok(maxErr < 1e-12, `emphasis+deemphasis round-trip max error: ${maxErr}`)
})

test('allpass.first — energy ≈ 1.0 for unit impulse', () => {
	let data = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
	audio.allpass.first(data, { a: 0.5 })
	let energy = 0
	for (let i = 0; i < data.length; i++) energy += data[i] * data[i]
	almost(energy, 1, 0.01)
})

test('comb — feedforward with delay=1', () => {
	let data = impulse(8)
	audio.comb(data, { delay: 1, gain: 0.5, type: 'feedforward' })
	almost(data[0], 1, EPSILON)
	almost(data[1], 0.5, EPSILON)
	almost(data[2], 0, EPSILON)
})

test('resonator — frequency response peak near fc', () => {
	let fc = 2000, fs = 44100, N = 4096
	let data = impulse(N)
	audio.resonator(data, { fc, bw: 50, fs })
	let peakFreq = 0, peakMag = 0
	for (let f = 500; f <= 5000; f += 25) {
		let mag = dftMag(data, f, fs)
		if (mag > peakMag) { peakMag = mag; peakFreq = f }
	}
	ok(Math.abs(peakFreq - fc) < 100, `resonator peak at ${peakFreq}Hz (expected ~${fc}Hz)`)
})

test('spectralTilt — slope=0 is passthrough', () => {
	let data = impulse(256)
	let orig = Float64Array.from(data)
	audio.spectralTilt(data, { slope: 0, fs: 44100 })
	let maxErr = 0
	for (let i = 0; i < data.length; i++) { let err = Math.abs(data[i] - orig[i]); if (err > maxErr) maxErr = err }
	ok(maxErr < EPSILON, `spectralTilt slope=0 passthrough: err=${maxErr}`)
})

test('variableBandwidth — highpass attenuates DC', () => {
	let data = dc(1024)
	audio.variableBandwidth(data, { fc: 2000, Q: 0.707, fs: 44100, type: 'highpass' })
	ok(Math.abs(data[1023]) < 0.1, `HP attenuates DC: last=${data[1023].toFixed(4)}`)
})

test('variableBandwidth — bandpass attenuates DC', () => {
	let data = dc(1024)
	audio.variableBandwidth(data, { fc: 2000, Q: 1, fs: 44100, type: 'bandpass' })
	ok(Math.abs(data[1023]) < 0.1, `BP attenuates DC: last=${data[1023].toFixed(4)}`)
})

test('dcBlocker — works with Float32Array input', () => {
	let data = new Float32Array(4096)
	data.fill(1)
	audio.dcBlocker(data, { R: 0.995 })
	ok(Math.abs(data[4095]) < 0.05, `Float32Array: last=${data[4095].toFixed(4)}`)
})

test('comb — works with plain Array input', () => {
	let data = [1, 0, 0, 0, 0, 0, 0, 0]
	audio.comb(data, { delay: 3, gain: 0.5, type: 'feedforward' })
	almost(data[0], 1, EPSILON)
	almost(data[3], 0.5, EPSILON)
})

test('notch — rejects target frequency', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.notch(data, { fc: 1000, Q: 30, fs })
	let mag1k = dftMag(data, 1000, fs)
	let mag500 = dftMag(data, 500, fs)
	ok(mag500 > mag1k * 10, `notch at 1kHz: 500Hz (${mag500.toFixed(3)}) >> 1kHz (${mag1k.toFixed(3)})`)
})

test('notch — unity gain away from fc', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.notch(data, { fc: 1000, Q: 30, fs })
	let magDC = dftMag(data, 50, fs)
	ok(Math.abs(magDC - 1) < 0.1, `notch DC gain ≈ 1 (got ${magDC.toFixed(4)})`)
})

test('notch — narrow Q=50 vs wide Q=5', () => {
	let fs = 44100, N = 4096
	let narrow = impulse(N), wide = impulse(N)
	audio.notch(narrow, { fc: 1000, Q: 50, fs })
	audio.notch(wide, { fc: 1000, Q: 5, fs })
	let narrowAt900 = dftMag(narrow, 900, fs)
	let wideAt900 = dftMag(wide, 900, fs)
	ok(narrowAt900 > wideAt900, `Q=50 passes 900Hz better (${narrowAt900.toFixed(3)}) than Q=5 (${wideAt900.toFixed(3)})`)
})

// ── Highpass / Lowpass / Bandpass ──────────────────────────────────────────

test('lowpass — attenuates above cutoff', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.lowpass(data, { fc: 1000, fs })
	let mag500 = dftMag(data, 500, fs)
	let mag5k = dftMag(data, 5000, fs)
	ok(mag500 > mag5k * 5, `lowpass 1kHz: 500Hz (${mag500.toFixed(3)}) >> 5kHz (${mag5k.toFixed(3)})`)
})

test('lowpass — passes DC', () => {
	let data = dc(1024)
	audio.lowpass(data, { fc: 1000, fs: 44100 })
	ok(Math.abs(data[1023] - 1) < 0.05, `lowpass passes DC: last=${data[1023].toFixed(4)}`)
})

test('lowpass — order 4 steeper than order 2', () => {
	let fs = 44100, N = 4096
	let d2 = impulse(N), d4 = impulse(N)
	audio.lowpass(d2, { fc: 1000, order: 2, fs })
	audio.lowpass(d4, { fc: 1000, order: 4, fs })
	let mag2 = dftMag(d2, 4000, fs)
	let mag4 = dftMag(d4, 4000, fs)
	ok(mag4 < mag2, `order 4 (${mag4.toFixed(4)}) attenuates more at 4kHz than order 2 (${mag2.toFixed(4)})`)
})

test('highpass — attenuates below cutoff', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.highpass(data, { fc: 1000, fs })
	let mag5k = dftMag(data, 5000, fs)
	let mag200 = dftMag(data, 200, fs)
	ok(mag5k > mag200 * 5, `highpass 1kHz: 5kHz (${mag5k.toFixed(3)}) >> 200Hz (${mag200.toFixed(3)})`)
})

test('highpass — removes DC', () => {
	let data = dc(2048)
	audio.highpass(data, { fc: 200, fs: 44100 })
	ok(Math.abs(data[2047]) < 0.05, `highpass blocks DC: last=${data[2047].toFixed(4)}`)
})

test('highpass — order 4 steeper than order 2', () => {
	let fs = 44100, N = 4096
	let d2 = impulse(N), d4 = impulse(N)
	audio.highpass(d2, { fc: 1000, order: 2, fs })
	audio.highpass(d4, { fc: 1000, order: 4, fs })
	let mag2 = dftMag(d2, 200, fs)
	let mag4 = dftMag(d4, 200, fs)
	ok(mag4 < mag2, `order 4 (${mag4.toFixed(4)}) attenuates more at 200Hz than order 2 (${mag2.toFixed(4)})`)
})

test('bandpass — passes center, rejects edges', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.bandpass(data, { fc: 1000, Q: 5, fs })
	let mag1k = dftMag(data, 1000, fs)
	let mag100 = dftMag(data, 100, fs)
	let mag10k = dftMag(data, 10000, fs)
	ok(mag1k > mag100 * 3, `bandpass: 1kHz (${mag1k.toFixed(3)}) >> 100Hz (${mag100.toFixed(3)})`)
	ok(mag1k > mag10k * 3, `bandpass: 1kHz (${mag1k.toFixed(3)}) >> 10kHz (${mag10k.toFixed(3)})`)
})

test('bandpass — Q controls width', () => {
	let fs = 44100, N = 4096
	let narrow = impulse(N), wide = impulse(N)
	audio.bandpass(narrow, { fc: 1000, Q: 10, fs })
	audio.bandpass(wide, { fc: 1000, Q: 1, fs })
	// Normalize by peak to isolate width: constant-skirt BPF peak scales with Q
	let narrowRatio = dftMag(narrow, 700, fs) / dftMag(narrow, 1000, fs)
	let wideRatio = dftMag(wide, 700, fs) / dftMag(wide, 1000, fs)
	ok(wideRatio > narrowRatio * 2, `Q=1 wider at 700Hz (ratio ${wideRatio.toFixed(3)}) than Q=10 (${narrowRatio.toFixed(3)})`)
})

// ── fail-first: fc is required ──────────────────────────────────────────────

test('lowpass — throws when params.fc is missing', () => {
	let threw = false
	try { audio.lowpass(impulse(8), { fs: 44100 }) }
	catch (e) { threw = true }
	ok(threw, 'lowpass throws instead of silently emitting NaN when fc is omitted')
})

// ── notch: exact null and unity gain (RBJ cookbook notch) ───────────────────

test('notch — exact null (-Infinity dB) at fc, unity gain ±1 octave away', () => {
	// RBJ Audio EQ Cookbook notch: zeros exactly on the unit circle at ±w0, so
	// |H(e^jw0)| = 0 exactly (up to float rounding) — not just "much smaller"
	let fs = 44100, fc = 1000
	let p = { fc, Q: 30, fs }
	audio.notch(impulse(4), p)
	let atFc = magDB(p.coefs, fc, fs)
	let below = magDB(p.coefs, fc / 2, fs)
	let above = magDB(p.coefs, fc * 2, fs)
	ok(atFc < -200, `notch null at fc: ${atFc}dB (expect -Infinity/very large negative)`)
	ok(Math.abs(below) < 0.01, `notch unity 1 octave below fc: ${below.toFixed(6)}dB`)
	ok(Math.abs(above) < 0.01, `notch unity 1 octave above fc: ${above.toFixed(6)}dB`)
})

// ── dcBlocker: cutoff formula ────────────────────────────────────────────────

test('dcBlocker — measured -3dB frequency matches (1-R)·fs/(2π)', () => {
	// H(z) = (1-z⁻¹)/(1-Rz⁻¹); -3dB point of a single real pole/zero pair at
	// this radius is well approximated by (1-R)*fs/(2*PI) for R close to 1
	let R = 0.995, fs = 44100
	let predicted = (1 - R) * fs / (2 * Math.PI)

	let gainDB = f => {
		let N = 8192
		let data = new Float64Array(N)
		for (let i = 0; i < N; i++) data[i] = Math.sin(2 * Math.PI * f * i / fs)
		audio.dcBlocker(data, { R })
		let start = N / 2, sum = 0
		for (let i = start; i < N; i++) sum += data[i] * data[i]
		let rms = Math.sqrt(sum / (N - start))
		return 20 * Math.log10(rms / Math.sqrt(0.5))
	}

	let lo = 1, hi = fs / 2
	for (let iter = 0; iter < 20; iter++) {
		let mid = (lo + hi) / 2
		if (gainDB(mid) < -3) lo = mid; else hi = mid
	}
	let measured = (lo + hi) / 2
	ok(Math.abs(measured - predicted) / predicted < 0.02, `dcBlocker -3dB: measured ${measured.toFixed(2)}Hz vs predicted ${predicted.toFixed(2)}Hz`)
})

// ── Butterworth order 6/8 rolloff ───────────────────────────────────────────

test('lowpass — Butterworth order 6/8 rolloff matches -6·order dB/octave', () => {
	// Nth-order Butterworth cascade: pole angles theta_m = pi*(2m+1)/(2N), Q_m = 1/(2 sin(theta_m))
	// order 6 -> Q = 0.5177, 0.7071, 1.9319; order 8 -> Q = 0.5098, 0.6013, 0.9000, 2.5629
	// (standard Butterworth pole-Q table, cf. Zumbahlen/Analog Devices filter design tables,
	// matches digital-filter/iir/butterworth.js's own theta=pi(2m+1)/(2N) pole formula)
	// asymptotic far-band rolloff of an order-N filter is exactly -6N dB/octave
	let fs = 44100, N = 32768, fc = 200
	for (let order of [6, 8]) {
		let data = impulse(N)
		audio.lowpass(data, { fc, order, fs })
		let f1 = 2000, f2 = 4000
		let slope = 20 * Math.log10(dftMag(data, f2, fs) / dftMag(data, f1, fs)) / Math.log2(f2 / f1)
		let expected = -6 * order
		ok(Math.abs(slope - expected) / Math.abs(expected) < 0.1, `order ${order}: measured ${slope.toFixed(2)}dB/oct vs expected ${expected}dB/oct`)
	}
})

// ── resonator: constant peak-gain (JOS two-zero form) ───────────────────────

test('resonator — peak gain ≈ 0dB across fc/bw/fs (JOS constant peak-gain resonator)', () => {
	// cf. Julius O. Smith III, "Introduction to Digital Filters", Two-Pole section,
	// "Constant Peak-Gain Resonator": H(z) = ((1-R²)/2)(1-z⁻²)/(1-2Rcos(w0)z⁻¹+R²z⁻²)
	// has |H| peak exactly 1 (0dB) for any fc/bw, unlike the bare one-zero-pair-less
	// two-pole form (gain = 1-R²) whose peak varies wildly with fc (up to +37dB)
	let fcs = [50, 440, 5000, 15000], bws = [5, 20, 200], fss = [44100, 48000]
	for (let fs of fss) for (let fc of fcs) for (let bw of bws) {
		if (fc >= fs / 2) continue
		let p = { fc, bw, fs }
		audio.resonator(new Float64Array(4), p)
		let sos = [{ b0: p._rB0, b1: 0, b2: p._rB2, a1: p._rA1, a2: p._rA2 }]
		// coarse scan to locate the peak, then refine locally at a step fine enough
		// for narrow bw (a fixed step would undersample a bw=5Hz resonance)
		let peak = -Infinity, peakF = 0
		for (let f = 1; f < fs / 2; f += 5) { let m = magDB(sos, f, fs); if (m > peak) { peak = m; peakF = f } }
		let fine = Math.max(bw / 100, 0.01)
		for (let f = Math.max(1, peakF - 10); f < peakF + 10; f += fine) { let m = magDB(sos, f, fs); if (m > peak) peak = m }
		ok(Math.abs(peak) < 0.01, `resonator peak fc=${fc} bw=${bw} fs=${fs}: ${peak.toFixed(4)}dB (expect ≈0dB)`)
	}
})

// ── spectralTilt: direction and measured dB/octave ──────────────────────────

test('spectralTilt — measured dB/octave matches slope sign+magnitude (100Hz-10kHz sweep)', () => {
	// positive slope = boost highs (readme: '+3dB/oct: pre-emphasis'); the 8-stage
	// octave-spaced shelving cascade only approximates the target slope, so use an
	// honest tolerance reflecting the actual measured deviation (~20%), not the ideal
	let fs = 44100
	let gainDB = (slope, f) => {
		let N = 65536
		let data = new Float64Array(N)
		for (let i = 0; i < N; i++) data[i] = Math.sin(2 * Math.PI * f * i / fs)
		audio.spectralTilt(data, { slope, fs })
		let start = N / 2, sum = 0
		for (let i = start; i < N; i++) sum += data[i] * data[i]
		let rms = Math.sqrt(sum / (N - start))
		return 20 * Math.log10(rms / Math.sqrt(0.5))
	}
	for (let slope of [3, -3, -6]) {
		let g100 = gainDB(slope, 100), g10k = gainDB(slope, 10000)
		let measured = (g10k - g100) / Math.log2(10000 / 100)
		ok(Math.sign(measured) === Math.sign(slope), `spectralTilt slope=${slope}: direction matches (measured ${measured.toFixed(2)}dB/oct)`)
		ok(Math.abs(measured - slope) / Math.abs(slope) < 0.3, `spectralTilt slope=${slope}: measured ${measured.toFixed(2)}dB/oct within 30% of nominal`)
	}
})

// ── comb: delay change on reused params ─────────────────────────────────────

test('comb — changing delay on a reused params object reallocates the delay line', () => {
	let p = { delay: 3, gain: 0.5, type: 'feedforward' }
	let d1 = impulse(8)
	audio.comb(d1, p)
	almost(d1[3], 0.5, EPSILON)

	p.delay = 5
	let d2 = impulse(10)
	audio.comb(d2, p)
	for (let i = 0; i < d2.length; i++) ok(Number.isFinite(d2[i]), `comb output finite at ${i} after delay change (got ${d2[i]})`)
	almost(d2[0], 1, EPSILON)
	almost(d2[5], 0.5, EPSILON)
	almost(d2[3], 0, EPSILON)
})

// ── allpass.second / variableBandwidth: fs must invalidate cached coefficients ─

test('allpass.second — changing fs alone (fc/Q fixed) recomputes coefficients', () => {
	let p = { fc: 1000, Q: 1, fs: 44100 }
	audio.allpass.second(impulse(8), p)
	let b0Before = p.coefs[0].b0

	p.fs = 96000
	audio.allpass.second(impulse(8), p)
	let b0After = p.coefs[0].b0

	ok(b0Before !== b0After, `allpass.second recomputes coefs on fs change (${b0Before} -> ${b0After})`)
})

test('variableBandwidth — changing fs alone (fc/Q fixed) recomputes coefficients', () => {
	// per-sample coefficients are derived from fc/Q/fs fresh every sample (no cache to
	// go stale), but guard the contract directly: isolate b0 via a 1-sample impulse
	// with state reset, and compare against the same underlying biquad math variable-bandwidth.js uses
	let p = { fc: 1000, Q: 0.707, fs: 44100, type: 'lowpass' }
	let d1 = [1]
	audio.variableBandwidth(d1, p)
	let b0Before = d1[0]

	p.fs = 96000
	p._state = [0, 0]
	let d2 = [1]
	audio.variableBandwidth(d2, p)
	let b0After = d2[0]

	ok(b0Before !== b0After, `variableBandwidth recomputes coefs on fs change (${b0Before} -> ${b0After})`)
})

// ── variableBandwidth: per-sample smoothing avoids clicks on parameter jumps ─

test('variableBandwidth — smoothed fc step has no discontinuity; plain lowpass clicks', () => {
	let fs = 44100, N = 4096, half = N / 2
	let tone = (n, off) => { let d = new Float64Array(n); for (let i = 0; i < n; i++) d[i] = Math.sin(2 * Math.PI * 200 * (i + off) / fs) * 0.5; return d }

	let clickRatio = (filterFn, extraParams) => {
		let p = { fc: 500, Q: 0.707, fs, ...extraParams }
		let out = new Float64Array(N)
		let d1 = tone(half, 0)
		filterFn(d1, p)
		out.set(d1, 0)
		p.fc = 5000
		let d2 = tone(half, half)
		filterFn(d2, p)
		out.set(d2, half)

		let baseline = 0
		for (let i = 1; i < half - 5; i++) baseline = Math.max(baseline, Math.abs(out[i] - out[i - 1]))
		let atBoundary = Math.abs(out[half] - out[half - 1])
		return { ratio: atBoundary / baseline, out }
	}

	let smoothed = clickRatio((d, p) => audio.variableBandwidth(d, p), { type: 'lowpass' })
	let plain = clickRatio((d, p) => audio.lowpass(d, p), {})

	ok(smoothed.ratio < 1.5, `variableBandwidth: boundary delta ${smoothed.ratio.toFixed(2)}x baseline (no click)`)
	ok(plain.ratio > 2.5, `plain lowpass: boundary delta ${plain.ratio.toFixed(2)}x baseline (clicks on abrupt coef jump)`)
})

test('variableBandwidth — steady-state response equals plain lowpass once converged', () => {
	let fs = 44100, N = 8192
	let a = dc(N)
	audio.variableBandwidth(a, { fc: 1000, Q: 0.707, fs, type: 'lowpass' })
	let b = dc(N)
	audio.lowpass(b, { fc: 1000, Q: 0.707, fs })
	almost(a[N - 1], b[N - 1], 1e-6)
})

// ── Float32Array input paths ─────────────────────────────────────────────────

test('Float32Array input — lowpass/highpass/bandpass/notch/resonator/spectralTilt/variableBandwidth/allpass produce finite output', () => {
	let fs = 44100
	let mk = () => { let d = new Float32Array(64); d[0] = 1; return d }
	let checks = [
		['lowpass', () => audio.lowpass(mk(), { fc: 1000, fs })],
		['highpass', () => audio.highpass(mk(), { fc: 1000, fs })],
		['bandpass', () => audio.bandpass(mk(), { fc: 1000, fs })],
		['notch', () => audio.notch(mk(), { fc: 1000, fs })],
		['resonator', () => audio.resonator(mk(), { fc: 1000, bw: 50, fs })],
		['spectralTilt', () => audio.spectralTilt(mk(), { slope: 3, fs })],
		['variableBandwidth', () => audio.variableBandwidth(mk(), { fc: 1000, Q: 0.707, fs })],
		['allpass.first', () => audio.allpass.first(new Float32Array([1, 0, 0, 0, 0, 0, 0, 0]), { a: 0.5 })],
		['allpass.second', () => audio.allpass.second(mk(), { fc: 1000, Q: 1, fs })],
	]
	for (let [name, run] of checks) {
		let out = run()
		ok(out instanceof Float32Array, `${name}: returns Float32Array`)
		ok(Array.from(out).every(Number.isFinite), `${name}: all output samples finite`)
	}
})

// Same invalidation class as crossfeed/graphicEq (eq brief): _coefs were built once
// from slope+fs inside `if (!params._s)` — flipping slope on a reused params object
// silently kept the old tilt, including its sign
test('spectralTilt — recomputes when slope changes on a reused params object', () => {
	let fs = 44100, N = 16384
	let p = { slope: 6, fs }
	let gainDB = f => {
		let data = new Float64Array(N)
		for (let i = 0; i < N; i++) data[i] = Math.sin(2 * Math.PI * f * i / fs)
		audio.spectralTilt(data, p)
		let sum = 0
		for (let i = N / 2; i < N; i++) sum += data[i] * data[i]
		return 20 * Math.log10(Math.sqrt(sum / (N / 2)) / Math.sqrt(0.5))
	}
	let up = gainDB(8000) - gainDB(250)
	ok(up > 6, `slope +6: highs boosted vs lows (${up.toFixed(1)} dB)`)

	p.slope = -6
	let down = gainDB(8000) - gainDB(250)
	ok(down < -6, `slope -6 on reused params: tilt flips (${down.toFixed(1)} dB)`)
})
