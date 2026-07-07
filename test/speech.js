import test, { ok, is, almost } from 'tst'
import formant from '@audio/speech-formant'
import vocoder from '@audio/speech-vocoder'
import { lpcAnalysis, lpcSynthesize } from '@audio/speech-lpc'
const audio = { formant, vocoder, lpcAnalysis, lpcSynthesize }
import { dftMag, impulse } from './util.js'

// Deterministic PRNG (mulberry32) for reproducible synthetic AR-process tests
function mulberry32 (seed) {
	return function () {
		seed |= 0; seed = seed + 0x6D2B79F5 | 0
		let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
		return ((t ^ t >>> 14) >>> 0) / 4294967296
	}
}

// Generate x[n] = Σ arCoefs[k]*x[n-1-k] + w[n], w ~ U(-sigma,sigma)
function genAR (arCoefs, N, sigma, seed) {
	let rnd = mulberry32(seed)
	let x = new Float64Array(N)
	let w = new Float64Array(N)
	let p = arCoefs.length
	for (let n = 0; n < N; n++) {
		let wn = (rnd() * 2 - 1) * sigma
		w[n] = wn
		let pred = 0
		for (let k = 0; k < p; k++) if (n - 1 - k >= 0) pred += arCoefs[k] * x[n - 1 - k]
		x[n] = pred + wn
	}
	return { x, w }
}

function lag1autocorr (sig) {
	let m = 0
	for (let i = 0; i < sig.length; i++) m += sig[i]
	m /= sig.length
	let num = 0, den = 0
	for (let i = 1; i < sig.length; i++) num += (sig[i] - m) * (sig[i - 1] - m)
	for (let i = 0; i < sig.length; i++) den += (sig[i] - m) * (sig[i] - m)
	return num / den
}

function rms (sig) {
	let s = 0
	for (let i = 0; i < sig.length; i++) s += sig[i] * sig[i]
	return Math.sqrt(s / sig.length)
}

test('formant — produces vowel-like output', () => {
	let data = impulse(512)
	audio.formant(data, {fs: 44100})
	ok(data.some(x => Math.abs(x) > 0.001), 'output present')
})

test('formant — output has significant energy', () => {
	let data = impulse(1024)
	audio.formant(data, {fs: 44100})
	let energy = 0
	for (let i = 0; i < data.length; i++) energy += data[i] * data[i]
	ok(energy > 0.0001, 'formant has energy (got ' + energy.toFixed(6) + ')')
	// Should have some non-zero output
	let hasOutput = data.some(x => Math.abs(x) > 0.0001)
	ok(hasOutput, 'formant produces output')
})

test('vocoder — output matches input length', () => {
	let N = 512
	let carrier = new Float64Array(N)
	let modulator = new Float64Array(N)
	for (let i = 0; i < N; i++) {
		carrier[i] = Math.sin(2 * Math.PI * 440 * i / 44100) // sawtooth-like
		modulator[i] = Math.sin(2 * Math.PI * 100 * i / 44100) * 0.5
	}
	let out = audio.vocoder(carrier, modulator, {bands: 8, fs: 44100})
	is(out.length, N, 'vocoder output length = input length')
	let hasOutput = out.some(x => Math.abs(x) > 0.0001)
	ok(hasOutput, 'vocoder produces nonzero output')
})

test('vocoder — silent modulator produces near-silent output', () => {
	let N = 512, fs = 44100
	let carrier = new Float64Array(N)
	for (let i = 0; i < N; i++) carrier[i] = Math.sin(2 * Math.PI * 440 * i / fs)
	let out = audio.vocoder(carrier, new Float64Array(N), { bands: 8, fs })
	let peak = 0
	for (let i = 0; i < N; i++) if (Math.abs(out[i]) > peak) peak = Math.abs(out[i])
	ok(peak < 0.01, `vocoder silent modulator: peak ${peak.toFixed(6)}`)
})

test('formant — custom /i/ vowel formants produce peaks', () => {
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.formant(data, { fs, formants: [{ fc: 270, bw: 60, gain: 1 }, { fc: 2290, bw: 120, gain: 0.7 }] })
	let mag270 = dftMag(data, 270, fs), mag2290 = dftMag(data, 2290, fs), mag800 = dftMag(data, 800, fs)
	ok(mag270 > mag800, `F1 peak at 270Hz (${mag270.toFixed(3)}) > valley (${mag800.toFixed(3)})`)
	ok(mag2290 > mag800, `F2 peak at 2290Hz (${mag2290.toFixed(3)}) > valley (${mag800.toFixed(3)})`)
})

test('lpcAnalysis — returns coefficients and residual', () => {
	let fs = 44100, N = 512
	let data = new Float64Array(N)
	for (let i = 0; i < N; i++) data[i] = Math.sin(2 * Math.PI * 440 * i / fs)
	let result = audio.lpcAnalysis(data, { order: 12 })
	is(result.coefs.length, 12, '12 LPC coefficients')
	ok(result.gain > 0, 'positive gain')
	is(result.residual.length, N, 'residual length matches input')
})

test('lpcAnalysis + lpcSynthesize — round-trip reconstructs signal', () => {
	let N = 256
	// Use a broadband signal (speech-like) for stable LPC model
	let data = new Float64Array(N)
	let seed = 42
	for (let i = 0; i < N; i++) {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff
		let noise = (seed / 0x7fffffff) * 2 - 1
		// Filtered noise (simple lowpass for speech-like spectrum)
		data[i] = i > 0 ? 0.5 * noise + 0.5 * data[i - 1] : noise
	}
	let orig = Float64Array.from(data)
	let { coefs, gain, residual } = audio.lpcAnalysis(data, { order: 10 })
	let res = Float64Array.from(residual)
	audio.lpcSynthesize(res, { coefs, gain })
	let maxErr = 0
	for (let i = 12; i < N; i++) {
		let err = Math.abs(res[i] - orig[i])
		if (err > maxErr) maxErr = err
	}
	ok(maxErr < 0.01, `LPC round-trip error: ${maxErr.toFixed(6)}`)
})

// speech/lpc.js:52 — residual sign error (e[n] = x[n] - Σ instead of x[n] + Σ) meant
// the returned residual was never actually whitened; differential test against a
// known AR(2) process, per Rabiner & Schafer / Makhoul (1975) autocorrelation-method
// Levinson-Durbin convention (a[0]=1, k_i=-(r[i]+Σ)/E ⇒ inverse filter e[n]=x[n]+Σa_k x[n-k])
test('lpcAnalysis — recovers known AR(2) coefficients', () => {
	// x[n] = 1.5x[n-1] - 0.7x[n-2] + w[n]; A(z)=1-1.5z⁻¹+0.7z⁻² ⇒ coefs=[-1.5, 0.7]
	let { x } = genAR([1.5, -0.7], 20000, 0.1, 12345)
	let { coefs } = audio.lpcAnalysis(x, { order: 2 })
	almost(coefs[0], -1.5, 0.02, 'a1 ≈ -1.5')
	almost(coefs[1], 0.7, 0.02, 'a2 ≈ 0.7')
})

test('lpcAnalysis — recovers known AR(4) coefficients (pole-placement)', () => {
	// Poles at r=0.9∠54°, r=0.7∠108° ⇒ A(z)=∏(1-2r_iC_iz⁻¹+r_i²z⁻²), closed-form
	// expansion gives A(z)=1-0.625390z⁻¹+0.842278z⁻²-0.168001z⁻³+0.396900z⁻⁴
	let trueA = [0.6253896620015253, -0.8422782073566228, 0.1680013209007709, -0.3969]
	let { x } = genAR(trueA, 20000, 0.05, 777)
	let { coefs } = audio.lpcAnalysis(x, { order: 4 })
	let expected = [-0.6253896620015253, 0.8422782073566228, -0.1680013209007709, 0.3969]
	for (let i = 0; i < 4; i++) almost(coefs[i], expected[i], 0.02, `a${i + 1} ≈ ${expected[i].toFixed(5)}`)
})

test('lpcAnalysis — residual is whitened (lag-1 autocorrelation ≈ 0)', () => {
	// AR(2) signal has lag-1 autocorrelation ≈0.88 (Yule-Walker: ρ1=φ1/(1-φ2) for
	// x[n]=φ1x[n-1]+φ2x[n-2]+w ⇒ ρ1=1.5/1.7≈0.882); a correctly-whitened residual's
	// lag-1 autocorrelation should be ≈0, not ≈0.87 as the pre-fix sign bug produced
	let { x } = genAR([1.5, -0.7], 20000, 0.1, 12345)
	let { residual } = audio.lpcAnalysis(x, { order: 2 })
	let lag1x = lag1autocorr(x)
	let lag1res = lag1autocorr(residual)
	almost(lag1x, 0.882, 0.02, `raw signal lag-1 autocorr ≈ 0.882 (got ${lag1x.toFixed(4)})`)
	ok(Math.abs(lag1res) < 0.02, `residual lag-1 autocorr ≈ 0 (got ${lag1res.toFixed(4)})`)
})

test('lpcAnalysis + lpcSynthesize — round-trip exact to 1e-9', () => {
	let { x } = genAR([1.5, -0.7], 20000, 0.1, 555)
	let { coefs, gain, residual } = audio.lpcAnalysis(x, { order: 2 })
	let rec = audio.lpcSynthesize(Float64Array.from(residual), { coefs, gain })
	let maxErr = 0
	for (let i = 0; i < x.length; i++) maxErr = Math.max(maxErr, Math.abs(rec[i] - x[i]))
	ok(maxErr < 1e-9, `round-trip maxErr ${maxErr.toExponential(3)} < 1e-9`)
})

test('lpcSynthesize — bounded output driven by independent excitation, peak near AR resonance', () => {
	// documented pitch-modification recipe (readme.md lpcSynthesize(buzz, {coefs, gain})):
	// drive with a pulse train, not the paired residual — must stay bounded and
	// resonate near the AR(2) pole frequency (poles of z²-1.5z+0.7=0 at 0.75±0.3708i,
	// angle=atan2(0.3708,0.75); resonance Hz = angle/(2π)·fs)
	let { x } = genAR([1.5, -0.7], 20000, 0.1, 12345)
	let { coefs, gain } = audio.lpcAnalysis(x, { order: 2 })
	let N = 4000, period = 40
	let pulses = new Float64Array(N)
	for (let n = 0; n < N; n += period) pulses[n] = 1
	let out = audio.lpcSynthesize(pulses, { coefs, gain })
	ok(out.every(Number.isFinite), 'synthesis output stays bounded (no Infinity/NaN)')
	let fsRef = 8000
	let f0 = Math.atan2(0.3708, 0.75) / (2 * Math.PI) * fsRef
	let magAtRes = dftMag(out, f0, fsRef), magOff = dftMag(out, f0 * 3, fsRef)
	ok(magAtRes > magOff, `spectral peak near resonance ${f0.toFixed(0)}Hz (${magAtRes.toFixed(3)}) > off-resonance (${magOff.toFixed(3)})`)
})

test('lpcSynthesize — doubling gain doubles output RMS', () => {
	let { x } = genAR([1.5, -0.7], 20000, 0.1, 12345)
	let { coefs } = audio.lpcAnalysis(x, { order: 2 })
	let N = 2000, period = 40
	let pulses = new Float64Array(N)
	for (let n = 0; n < N; n += period) pulses[n] = 1
	let out1 = audio.lpcSynthesize(Float64Array.from(pulses), { coefs, gain: 1 })
	let out2 = audio.lpcSynthesize(Float64Array.from(pulses), { coefs, gain: 2 })
	// zero-initial-state recursion is linear in gain: y[n]=gain·u[n]-Σcoefs[k]y[n-1-k]
	almost(rms(out2) / rms(out1), 2, 1e-6, 'RMS scales linearly with gain')
})

test('lpcAnalysis — gain is invariant to frame length for stationary input', () => {
	// r[i] normalized per-sample (÷N) ⇒ E (and gain=√E) is a per-sample power,
	// independent of frame length, for a stationary process (Rabiner & Schafer §8.3)
	let gains = [512, 2048, 8192, 32768].map(N => {
		let { x } = genAR([1.5, -0.7], N, 0.1, 999)
		return audio.lpcAnalysis(x, { order: 2 }).gain
	})
	let mean = gains.reduce((s, g) => s + g, 0) / gains.length
	for (let g of gains) ok(Math.abs(g - mean) / mean < 0.1, `gain ${g.toFixed(4)} within 10% of mean ${mean.toFixed(4)} across frame lengths`)
})

// speech/formant.js:23 — `f.gain || 1` (and formerly a `_gain` name collision with
// effect/resonator.js's own internal gain field) made an explicit gain:0 band non-silent
test('formant — gain:0 mutes the band', () => {
	let data = impulse(2048)
	audio.formant(data, { fs: 44100, formants: [{ fc: 1000, bw: 80, gain: 0 }] })
	let energy = 0
	for (let i = 0; i < data.length; i++) energy += data[i] * data[i]
	is(energy, 0, `gain:0 produces zero energy (got ${energy})`)
})

test('formant — gain scales output energy (∝ gain²)', () => {
	let e = g => {
		let data = impulse(2048)
		audio.formant(data, { fs: 44100, formants: [{ fc: 1000, bw: 80, gain: g }] })
		let s = 0
		for (let i = 0; i < data.length; i++) s += data[i] * data[i]
		return s
	}
	let e1 = e(1), e2 = e(2)
	almost(e2 / e1, 4, 0.05, `energy(gain=2)/energy(gain=1) ≈ 4 (got ${(e2 / e1).toFixed(3)})`)
})

// speech/formant.js:22 — _states was built once and never rebuilt when params.formants
// changed on a reused params object, silently keeping the filter tuned to the stale target
test('formant — rebuilds filter bank when formants change on a reused params object', () => {
	let fs = 44100, N = 4096
	let params = { fs, formants: [{ fc: 730, bw: 90, gain: 1 }] }
	audio.formant(impulse(N), params) // first call, builds _states for F1=730Hz

	params.formants = [{ fc: 270, bw: 60, gain: 1 }] // reassign to a different target
	let d2 = impulse(N)
	audio.formant(d2, params)

	let dFresh = impulse(N)
	audio.formant(dFresh, { fs, formants: [{ fc: 270, bw: 60, gain: 1 }] })

	let mag270reused = dftMag(d2, 270, fs), mag270fresh = dftMag(dFresh, 270, fs)
	almost(mag270reused, mag270fresh, mag270fresh * 0.05, `retuned filter (${mag270reused.toFixed(3)}) matches a fresh 270Hz filter (${mag270fresh.toFixed(3)})`)
	ok(dftMag(d2, 730, fs) < mag270reused, 'no longer resonating at the stale 730Hz target')
})

test('formant — rebuilds when a band object is mutated in place (fc/bw/gain edited, not reassigned)', () => {
	let fs = 44100, N = 4096
	let params = { fs, formants: [{ fc: 730, bw: 90, gain: 1 }] }
	audio.formant(impulse(N), params)

	params.formants[0].fc = 270 // mutate the existing band object's content
	params.formants[0].bw = 60
	let d2 = impulse(N)
	audio.formant(d2, params)

	ok(dftMag(d2, 270, fs) > dftMag(d2, 730, fs), 'retunes to mutated fc=270Hz, not stale fc=730Hz')
})

test('formant — default formant bank resolves F1/F2/F3 as distinct peaks (relative structure)', () => {
	// Assert relative peak-vs-valley structure, not absolute dB levels — resonator.js's
	// constant-peak-gain normalization is owned/fixed by a different worker
	let fs = 44100, N = 4096
	let data = impulse(N)
	audio.formant(data, { fs }) // default formants: F1=730, F2=1090, F3=2440 Hz
	let f1 = dftMag(data, 730, fs), f2 = dftMag(data, 1090, fs), f3 = dftMag(data, 2440, fs)
	let valley1 = dftMag(data, 900, fs), valley2 = dftMag(data, 1700, fs)
	ok(f1 > valley1, `F1 (${f1.toFixed(3)}) > valley between F1/F2 (${valley1.toFixed(3)})`)
	ok(f2 > valley1, `F2 (${f2.toFixed(3)}) > valley between F1/F2 (${valley1.toFixed(3)})`)
	ok(f2 > valley2, `F2 (${f2.toFixed(3)}) > valley between F2/F3 (${valley2.toFixed(3)})`)
	ok(f3 > valley2, `F3 (${f3.toFixed(3)}) > valley between F2/F3 (${valley2.toFixed(3)})`)
})

// speech/vocoder.js:37 — filter bank built once and never rebuilt, so changing
// params.bands/fmin/fmax/fs on a reused params object crashed inside digital-filter's
// filter() (stale-length _analysis/_synthesis arrays indexed by the new band count)
test('vocoder — rebuilds filter bank when bands change on a reused params object', () => {
	let N = 512, fs = 44100
	let carrier = new Float64Array(N), modulator = new Float64Array(N)
	for (let i = 0; i < N; i++) {
		carrier[i] = Math.sin(2 * Math.PI * 440 * i / fs)
		modulator[i] = Math.sin(2 * Math.PI * 100 * i / fs) * 0.5
	}
	let params = { bands: 4, fmin: 100, fmax: 8000, fs }
	audio.vocoder(carrier, modulator, params)
	is(params._analysis.length, 4, 'first call builds 4-band filter bank')

	params.bands = 32
	let out = audio.vocoder(carrier, modulator, params)
	is(params._analysis.length, 32, 'second call rebuilds to 32-band filter bank')
	ok(out.every(Number.isFinite), 'no crash / non-finite output after band-count change')
})

// Same stale-size class as gammatone's _s (auditory brief): lpcSynthesize allocated
// _s once at coefs.length and never resized — a reused params object with a different
// order read past the buffer, poisoning output with NaN
test('lpcSynthesize — resizes state when coefs order changes on a reused params object', () => {
	let u = () => Float64Array.from({ length: 64 }, (_, i) => (i === 0 ? 1 : 0))
	let params = { coefs: [0.5, -0.2], gain: 1 }
	audio.lpcSynthesize(u(), params)
	is(params._s.length, 2, 'first call allocates order-2 state')

	params.coefs = [0.5, -0.2, 0.1, -0.05, 0.02, -0.01]
	let out = audio.lpcSynthesize(u(), params)
	is(params._s.length, 6, 'second call reallocates to order-6 state')
	ok(out.every(Number.isFinite), 'finite output after order change')
})
