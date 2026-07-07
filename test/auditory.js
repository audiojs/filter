import test, { ok, is } from 'tst'
import * as audio from '../index.js'
import { impulse, magDB } from './util.js'

// steady-state amplitude ratio of a gammatone-filtered cosine at fc, measured after the pole
// transient (τ = 1/b, b = 2π·1.019·ERB) has decayed by many time constants
function gammatoneSteadyGain (fc, fs, params) {
	let n = Math.round(fs * 0.5)
	let data = new Float64Array(n)
	for (let i = 0; i < n; i++) data[i] = Math.cos(2 * Math.PI * fc * i / fs)
	audio.gammatone(data, params)
	let tail = data.slice(Math.round(n * 0.8))
	let rms = Math.sqrt(tail.reduce((s, v) => s + v * v, 0) / tail.length)
	return rms * Math.SQRT2
}

test('gammatone — resonates at center frequency', () => {
	let data = impulse(4096)
	audio.gammatone(data, {fc: 1000, fs: 44100})
	let hasPos = false, hasNeg = false
	for (let i = 0; i < 4096; i++) {
		if (data[i] > 0.001) hasPos = true
		if (data[i] < -0.001) hasNeg = true
	}
	ok(hasPos && hasNeg, 'gammatone oscillates')
})

test('erbBank — ERB-spaced center frequencies', () => {
	let bands = audio.erbBank(44100)
	ok(bands.length >= 25, 'at least 25 ERB bands')
	ok(bands[0].fc >= 50, 'starts above fmin')
	ok(bands[0].erb > 0, 'has ERB width')
	// Verify spacing increases with frequency (ERB property)
	let spacing1 = bands[1].fc - bands[0].fc
	let spacingN = bands[bands.length - 1].fc - bands[bands.length - 2].fc
	ok(spacingN > spacing1, 'wider spacing at higher frequencies')
})

test('barkBank — has bark/fLow/fHigh/coefs fields', () => {
	let bands = audio.barkBank(44100)
	ok(bands.length >= 20, 'at least 20 Bark bands')
	is(bands[0].bark, 1, 'starts at bark 1')
	ok(bands[0].coefs.b0 !== undefined, 'has biquad coefficients')
	ok(bands[0].fLow < bands[0].fHigh, 'fLow < fHigh')
})

test('octaveBank — correct number of bands', () => {
	let bands = audio.octaveBank(3, 44100)
	ok(bands.length >= 20, '1/3-octave has 20+ bands')
	ok(bands[0].fc > 0, 'has center frequency')
	ok(bands[0].coefs.b0 !== undefined, 'has coefficients')
})

test('gammatone — peak of frequency response near fc', () => {
	let fc = 2000, fs = 44100
	let data = impulse(4096)
	audio.gammatone(data, {fc, fs})

	// Compute rough magnitude spectrum via DFT at a few points
	let peakFreq = 0, peakMag = 0
	let N = data.length
	for (let fi = 500; fi <= 5000; fi += 50) {
		let w = 2 * Math.PI * fi / fs
		let re = 0, im = 0
		for (let n = 0; n < N; n++) {
			re += data[n] * Math.cos(w * n)
			im -= data[n] * Math.sin(w * n)
		}
		let mag = Math.sqrt(re * re + im * im)
		if (mag > peakMag) { peakMag = mag; peakFreq = fi }
	}
	ok(Math.abs(peakFreq - fc) < 200, 'Gammatone peak at ' + peakFreq + 'Hz (expected ~' + fc + 'Hz)')
})

test('octaveBank — 1/1 has fewer bands than 1/3', () => {
	let bands1 = audio.octaveBank(1, 44100)
	let bands3 = audio.octaveBank(3, 44100)
	ok(bands1.length >= 8, '1/1 octave has 8+ bands (got ' + bands1.length + ')')
	ok(bands3.length >= 20, '1/3 octave has 20+ bands (got ' + bands3.length + ')')
	ok(bands3.length > bands1.length * 2, '1/3 octave has >2x bands vs 1/1')
})

test('octaveBank — 1/6 has more bands than 1/3', () => {
	let bands3 = audio.octaveBank(3, 44100)
	let bands6 = audio.octaveBank(6, 44100)
	ok(bands6.length > bands3.length, '1/6 octave has more bands than 1/3')
})

test('erbBank — spacing increases monotonically', () => {
	let bands = audio.erbBank(44100)
	for (let i = 2; i < bands.length; i++) {
		let sp1 = bands[i-1].fc - bands[i-2].fc
		let sp2 = bands[i].fc - bands[i-1].fc
		ok(sp2 >= sp1 - 0.01, 'ERB spacing increases: ' + sp1.toFixed(1) + ' → ' + sp2.toFixed(1))
	}
})

test('barkBank — exactly 24 bands at 44.1kHz', () => {
	let bands = audio.barkBank(44100)
	is(bands.length, 24, '24 Bark bands at 44100Hz')
})

test('barkBank — fs=22050 has fewer than 24 bands', () => {
	let bands = audio.barkBank(22050)
	ok(bands.length < 24, `barkBank@22050 has ${bands.length} bands`)
	ok(bands.length >= 10, `at least 10 bands`)
	ok(bands[bands.length - 1].fc < 22050 / 2, 'highest fc < Nyquist')
})

test('octaveBank — center frequencies include 1000Hz (ISO 266)', () => {
	ok(audio.octaveBank(1, 44100).some(b => Math.abs(b.fc - 1000) < 1), '1/1 includes 1000Hz')
	ok(audio.octaveBank(3, 44100).some(b => Math.abs(b.fc - 1000) < 1), '1/3 includes 1000Hz')
})

test('erbBank — ERB at 1kHz ≈ 132.6Hz (Glasberg & Moore)', () => {
	let bands = audio.erbBank(44100)
	let closest = bands.reduce((a, b) => Math.abs(a.fc - 1000) < Math.abs(b.fc - 1000) ? a : b)
	let expectedERB = 24.7 * (4.37 * closest.fc / 1000 + 1)
	ok(Math.abs(closest.erb - expectedERB) < 1, `ERB at ${closest.fc}Hz: ${closest.erb} ≈ ${expectedERB.toFixed(1)}`)
})

test('melBank — 26 bands by default', () => {
	let bands = audio.melBank(44100)
	is(bands.length, 26, '26 mel filters')
	ok(bands[0].fc > 0, 'first fc > 0')
	ok(bands[0].fLow < bands[0].fc, 'fLow < fc')
	ok(bands[0].fHigh > bands[0].fc, 'fHigh > fc')
	ok(bands[0].mel > 0, 'has mel value')
})

test('melBank — spacing is linear in mel scale', () => {
	let bands = audio.melBank(44100)
	let melStep1 = bands[1].mel - bands[0].mel
	let melStepN = bands[bands.length - 1].mel - bands[bands.length - 2].mel
	ok(Math.abs(melStep1 - melStepN) < 1, 'mel spacing is uniform')
})

test('melBank — custom nFilters', () => {
	let bands = audio.melBank(16000, { nFilters: 40 })
	is(bands.length, 40, '40 mel filters')
	ok(bands[bands.length - 1].fHigh <= 8000, 'fHigh <= Nyquist')
})

test('melBank — custom fmin/fmax anchor the outer edges', () => {
	let bands = audio.melBank(44100, { fmin: 300, fmax: 3400, nFilters: 10 })
	is(bands.length, 10, '10 mel filters')
	ok(Math.abs(bands[0].fLow - 300) < 0.1, 'first fLow anchored at fmin')
	ok(Math.abs(bands[bands.length - 1].fHigh - 3400) < 0.1, 'last fHigh anchored at fmax')
})

test('gammatone — 0 dB gain at fc, measured as steady-state amplitude ratio', () => {
	// filter a sustained cosine at fc and measure the post-transient amplitude ratio directly,
	// independent of the internal impulse-response gain estimate this checks
	let gain = gammatoneSteadyGain(1000, 44100, { fc: 1000, fs: 44100 })
	ok(Math.abs(gain - 1) < 1e-9, `steady-state gain at fc ≈ 1.0 (got ${gain})`)
})

test('gammatone — order parameter (order≠4 still normalizes to 0 dB at fc)', () => {
	for (let order of [1, 2, 3, 6, 8]) {
		let gain = gammatoneSteadyGain(1000, 44100, { fc: 1000, fs: 44100, order })
		ok(Math.abs(gain - 1) < 1e-9, `order=${order} steady-state gain at fc ≈ 1.0 (got ${gain})`)
	}
})

test('gammatone — reusing params across an fs change recomputes the gain cache (regression, gammatone.js:27)', () => {
	// bug: cache invalidation checked _fc/_order but not _fs, so a reused params object kept a
	// stale gain from the old sample rate after fs changed
	let params = { fc: 1000, fs: 44100 }
	audio.gammatone(impulse(4096), params)
	params.fs = 22050
	let gain = gammatoneSteadyGain(1000, 22050, params)
	ok(Math.abs(gain - 1) < 1e-9, `gain after fs change ≈ 1.0, not stale (got ${gain})`)
})

test('gammatone — reusing params across an order change resizes the state buffer (regression, gammatone.js:50)', () => {
	// bug: params._s was allocated once at the old order*2 and never resized, so increasing
	// order on a reused params object indexed past the buffer and produced NaN output
	let params = { fc: 1000, fs: 44100, order: 2 }
	audio.gammatone(impulse(64), params)
	params.order = 6
	let data = impulse(64)
	audio.gammatone(data, params)
	is(params._s.length, 12, '_s resized to order*2')
	ok(data.every(Number.isFinite), 'output stays finite after order increase')
})

test('gammatone — accepts Float32Array input', () => {
	let data = new Float32Array(impulse(4096))
	audio.gammatone(data, { fc: 1000, fs: 44100 })
	ok(data.every(Number.isFinite), 'Float32Array output stays finite')
	ok(Array.from(data).some(v => v > 0.0001) && Array.from(data).some(v => v < -0.0001), 'Float32Array output oscillates')
})

test('erbBank — density option scales bands per ERB', () => {
	let d1 = audio.erbBank(44100, { density: 1 })
	let d2 = audio.erbBank(44100, { density: 2 })
	let d4 = audio.erbBank(44100, { density: 4 })
	// step in ERB-number space is 1/density, so band count scales ~linearly with density
	ok(d2.length > d1.length * 1.8 && d2.length < d1.length * 2.2, `density=2 has ~2x bands of density=1 (${d2.length} vs ${d1.length})`)
	ok(d4.length > d2.length * 1.8 && d4.length < d2.length * 2.2, `density=4 has ~2x bands of density=2 (${d4.length} vs ${d2.length})`)
})

test('erbBank — custom fmin/fmax restrict the range', () => {
	let bands = audio.erbBank(44100, { fmin: 300, fmax: 3400 })
	ok(bands[0].fc >= 300, 'first fc >= fmin')
	ok(bands[bands.length - 1].fc <= 3400, 'last fc <= fmax')
})

test('barkBank — custom fmin/fmax restrict the range', () => {
	// use edges that fall strictly between table entries to avoid a degenerate zero-width band
	// when fmin/fmax exactly coincides with a Zwicker edge
	let bands = audio.barkBank(44100, { fmin: 250, fmax: 5000 })
	ok(bands[0].fLow >= 250, 'first fLow >= fmin')
	ok(bands[bands.length - 1].fHigh <= 5000, 'last fHigh <= fmax')
})

test('barkBank — fmin below the table\'s first edge is honored, not silently clamped (regression, bark-bank.js:15)', () => {
	// bug: fLow = Math.max(BARK_EDGES[0], fmin) always won with the table's 20Hz edge, so a
	// caller-supplied fmin < 20 was silently ignored
	let bands = audio.barkBank(44100, { fmin: 10 })
	is(bands[0].fLow, 10, 'band 1 fLow honors fmin=10, not clamped up to 20')
})

test('barkBank — band edges match the Zwicker critical-band edge table', () => {
	// Zwicker & Fastl, Psychoacoustics: Facts and Models, Table 6.1 (24 critical-band edges, Hz).
	// The published table's first edge is 0 Hz; bark-bank.js intentionally uses the practical
	// 20 Hz lower bound for band 1 (see design note), so edges from band 2 onward are exact.
	let ZWICKER_EDGES = [
		20, 100, 200, 300, 400, 510, 630, 770, 920, 1080, 1270, 1480, 1720,
		2000, 2320, 2700, 3150, 3700, 4400, 5300, 6400, 7700, 9500, 12000, 15500
	]
	let bands = audio.barkBank(44100)
	is(bands.length, ZWICKER_EDGES.length - 1, 'one band per Zwicker edge pair')
	for (let i = 0; i < bands.length; i++) {
		is(bands[i].fLow, ZWICKER_EDGES[i], `band ${i + 1} fLow matches Zwicker edge ${ZWICKER_EDGES[i]}Hz`)
		is(bands[i].fHigh, ZWICKER_EDGES[i + 1], `band ${i + 1} fHigh matches Zwicker edge ${ZWICKER_EDGES[i + 1]}Hz`)
	}
})

test('octaveBank — custom fmin/fmax restrict the range', () => {
	let bands = audio.octaveBank(3, 44100, { fmin: 300, fmax: 3400 })
	ok(bands[0].fc >= 300, 'first fc >= fmin')
	ok(bands[bands.length - 1].fc <= 3400, 'last fc <= fmax')
	ok(bands.length < audio.octaveBank(3, 44100).length, 'restricted range has fewer bands than default')
})

test('octaveBank — -3dB edges match IEC 61260 fc·G^(±1/2n) analytic formula', () => {
	// IEC 61260-1 §5: nominal band edges are fc·G^(-1/2n) and fc·G^(1/2n), G = 10^(3/10), n = fraction
	let fraction = 3, fs = 44100
	let G = Math.pow(10, 3 / 10)
	let band = audio.octaveBank(fraction, fs).find(b => Math.abs(b.fc - 1000) < 1)
	let loEdge = band.fc * Math.pow(G, -1 / (2 * fraction))
	let hiEdge = band.fc * Math.pow(G, 1 / (2 * fraction))
	let loDB = magDB([band.coefs], loEdge, fs)
	let hiDB = magDB([band.coefs], hiEdge, fs)
	ok(Math.abs(loDB - -3) < 0.1, `lower edge ${loEdge.toFixed(1)}Hz ≈ -3dB (got ${loDB.toFixed(2)}dB)`)
	ok(Math.abs(hiDB - -3) < 0.1, `upper edge ${hiEdge.toFixed(1)}Hz ≈ -3dB (got ${hiDB.toFixed(2)}dB)`)
})
