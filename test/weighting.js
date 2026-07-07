import test, { almost, ok, is } from 'tst'
import * as audio from '../index.js'
import { freqz, mag2db } from 'digital-filter'
import { magDB, EPSILON, impulse } from './util.js'

// IEC 61672-1:2013 Table 2 — A-weighting nominal values (dB)
const IEC_A = {
	31.5: -39.4, 63: -26.2, 125: -16.1, 250: -8.6, 500: -3.2,
	1000: 0.0, 2000: 1.2, 4000: 1.0, 8000: -1.1, 10000: -2.5,
	16000: -6.6, 20000: -9.3
}

// IEC 61672-1:2013 Table 2 — C-weighting nominal values (dB)
const IEC_C = {
	31.5: -3.0, 63: -0.8, 125: -0.2, 250: 0.0, 500: 0.0,
	1000: 0.0, 2000: -0.2, 4000: -0.8, 8000: -3.0
}

// Rec. ITU-R BS.468-4 Annex 1 table, dB rel 1kHz (reproduced in Wikipedia
// "ITU-R 468 noise weighting"; digits also embedded in itu468-poles.mjs
// used to derive the analog pole positions in weighting/itu468.js)
const BS468 = {
	31.5: -29.9, 63: -23.9, 100: -19.8, 200: -13.8, 400: -7.8, 800: -1.9,
	1000: 0, 2000: 5.6, 3150: 9.0, 4000: 10.5, 5000: 11.7, 6300: 12.2,
	7100: 12.0, 8000: 11.4, 9000: 10.1, 10000: 8.1, 12500: 0, 14000: -5.3,
	16000: -11.7, 20000: -22.2
}

// Matched-z discretization of the itu468 analog prototype (0.05dB max error,
// see itu468-poles.mjs) is near-exact away from Nyquist and degrades close to
// it; tolerances below are measured envelopes (script:
// scratchpad/fix-weighting/verify-itu468.mjs), not arbitrary slack.
function itu468Tol(fs, f) {
	if (f <= 800) return 0.15
	if (f <= 6300) return fs >= 96000 ? 0.6 : fs >= 48000 ? 1.5 : 1.8
	if (f <= 10000) return fs >= 96000 ? 1.0 : fs >= 48000 ? 3.5 : 4.2
	return fs >= 96000 ? 3.5 : fs >= 48000 ? 14.5 : 17.5
}

test('aWeighting — IEC 61672 table values at 96kHz', () => {
	// matched z-transform: ≤10kHz excellent; 16–20kHz within IEC Class 1 (±2 dB)
	let sos = audio.aWeighting.coefs(96000)
	for (let [f, expected] of Object.entries(IEC_A)) {
		let tol = +f >= 16000 ? 1.5 : 0.5
		let got = magDB(sos, +f, 96000)
		ok(Math.abs(got - expected) < tol, `A-weighting ${f}Hz: expected ${expected}, got ${got.toFixed(2)} dB`)
	}
})

test('aWeighting — IEC 61672 table values at 48kHz', () => {
	// matched z-transform: ≤8kHz < 1 dB; 10kHz ~1.1 dB (IEC Class 1 boundary);
	// 16–20kHz: better than bilinear (4 dB vs 12 dB error) but 48kHz is insufficient there
	let sos = audio.aWeighting.coefs(48000)
	for (let [f, expected] of Object.entries(IEC_A)) {
		let tol = +f >= 16000 ? 5.0 : +f >= 10000 ? 1.2 : 1.0
		let got = magDB(sos, +f, 48000)
		ok(Math.abs(got - expected) < tol, `A-weighting ${f}Hz@48kHz: expected ${expected}, got ${got.toFixed(2)} dB`)
	}
})

test('cWeighting — IEC 61672 table values at 96kHz', () => {
	let sos = audio.cWeighting.coefs(96000)
	for (let [f, expected] of Object.entries(IEC_C)) {
		let got = magDB(sos, +f, 96000)
		ok(Math.abs(got - expected) < 0.5, `C-weighting ${f}Hz: expected ${expected}, got ${got.toFixed(2)} dB`)
	}
})

test('aWeighting — 3 SOS sections via coefs', () => {
	let sos = audio.aWeighting.coefs(44100)
	is(sos.length, 3, '3 sections')
	ok(sos[0].b0 !== undefined, 'has coefficients')
})

test('aWeighting — 0dB at 1kHz (analytic normalization exactness)', () => {
	// matchedZ's normalize() sets gain to exactly 0dB at normFreq by construction;
	// evaluated directly (magDB) rather than via freqz's rounded FFT bin, whose
	// nearest-bin frequency error alone (~1.3Hz off at 44100/2048) already exceeds 1e-3dB
	let sos = audio.aWeighting.coefs(44100)
	let db = magDB(sos, 1000, 44100)
	almost(db, 0, 1e-9, 'A-weighting exactly 0dB at 1kHz, got ' + db)
})

test('aWeighting — in-place processing', () => {
	let data = impulse(512)
	let p = { fs: 44100 }
	audio.aWeighting(data, p)
	let hasOutput = false
	for (let v of data) if (Math.abs(v) > 1e-10) { hasOutput = true; break }
	ok(hasOutput, 'aWeighting produces output')
})

test('cWeighting — 2 SOS sections via coefs', () => {
	let sos = audio.cWeighting.coefs(44100)
	is(sos.length, 2, '2 sections')
})

test('cWeighting — 0dB at 1kHz (analytic normalization exactness)', () => {
	let sos = audio.cWeighting.coefs(44100)
	let db = magDB(sos, 1000, 44100)
	almost(db, 0, 1e-9, 'C-weighting exactly 0dB at 1kHz, got ' + db)
})

test('cWeighting — in-place processing', () => {
	let data = impulse(512)
	let p = { fs: 44100 }
	audio.cWeighting(data, p)
	let hasOutput = false
	for (let v of data) if (Math.abs(v) > 1e-10) { hasOutput = true; break }
	ok(hasOutput, 'cWeighting produces output')
})

test('kWeighting 48kHz — exact BS.1770-4 Annex 1 coefficients (all 5 coefs, both stages)', () => {
	// ITU-R BS.1770-4 Annex 1: pre-filter stage 1 (high shelf) and stage 2 (RLB highpass)
	let sos = audio.kWeighting.coefs(48000)
	is(sos.length, 2, '2 stages')
	almost(sos[0].b0, 1.53512485958697, EPSILON)
	almost(sos[0].b1, -2.69169618940638, EPSILON)
	almost(sos[0].b2, 1.19839281085285, EPSILON)
	almost(sos[0].a1, -1.69065929318241, EPSILON)
	almost(sos[0].a2, 0.73248077421585, EPSILON)
	almost(sos[1].b0, 1.0, EPSILON)
	almost(sos[1].b1, -2.0, EPSILON)
	almost(sos[1].b2, 1.0, EPSILON)
	almost(sos[1].a1, -1.99004745483398, EPSILON)
	almost(sos[1].a2, 0.99007225036621, EPSILON)
})

test('kWeighting other rate — still returns 2 sections', () => {
	let sos = audio.kWeighting.coefs(44100)
	is(sos.length, 2, '2 stages at 44100')
})

test('kWeighting 44100Hz — shelf matches analog design gain at DC/Nyquist', () => {
	// Independent reference check at a non-48kHz rate: for ANY correctly
	// bilinear-transformed 2nd-order analog shelf, z=1 (DC) maps exactly to
	// s=0 and z=-1 (Nyquist) maps exactly to s=∞ (Zölzer, "Digital Audio
	// Signal Processing", bilinear transform frequency mapping) — so the
	// digital shelf's gain at DC must equal the analog low-frequency
	// asymptote (0dB, unity) and at Nyquist must equal the analog high-shelf
	// gain G exactly, for every sample rate, independent of the specific
	// coefficient formula used to reach it.
	let G = 3.999843853973347 // weighting/k-weighting.js shelf gain constant
	for (let fs of [44100, 96000, 192000]) {
		let shelf = [audio.kWeighting.coefs(fs)[0]]
		almost(magDB(shelf, 1e-6, fs), 0, 1e-6, `shelf@${fs} ≈0dB at DC`)
		almost(magDB(shelf, fs / 2 - 1e-6, fs), G, 1e-6, `shelf@${fs} ≈${G}dB at Nyquist`)
	}
})

test('kWeighting 44100Hz — RLB stage keeps unnormalized {1,-2,1} numerator at any fs', () => {
	// ITU-R BS.1770-4 Annex 1: RLB highpass b-coefficients are the fixed
	// double-zero-at-DC numerator (1 - z^-1)^2, unnormalized, independent of fs
	for (let fs of [44100, 48000, 96000]) {
		let rlb = audio.kWeighting.coefs(fs)[1]
		is(rlb.b0, 1, `rlb.b0@${fs}`)
		is(rlb.b1, -2, `rlb.b1@${fs}`)
		is(rlb.b2, 1, `rlb.b2@${fs}`)
	}
})

test('itu468 — exact 3 SOS sections (6 matched-z poles paired into 3 biquads)', () => {
	let sos = audio.itu468.coefs(48000)
	is(sos.length, 3, '3 sections')
})

test('itu468 — in-place processing', () => {
	let data = impulse(512)
	let p = { fs: 48000 }
	audio.itu468(data, p)
	let hasOutput = false
	for (let v of data) if (Math.abs(v) > 1e-10) { hasOutput = true; break }
	ok(hasOutput, 'itu468 produces output')
})

test('riaa — returns 1 section', () => {
	let sos = audio.riaa.coefs(44100)
	is(sos.length, 1, '1 section')
})

test('riaa — bass boost at 20Hz', () => {
	let sos = audio.riaa.coefs(44100)
	let resp = freqz(sos, 4096, 44100)
	let idx20 = Math.round(20 / (44100 / 2) * 4096)
	let idx1k = Math.round(1000 / (44100 / 2) * 4096)
	let db20 = mag2db(resp.magnitude[idx20])
	let db1k = mag2db(resp.magnitude[idx1k])
	ok(db20 > db1k + 10, 'RIAA boosts bass (20Hz > 1kHz by >10dB)')
})

test('riaa — in-place processing', () => {
	let data = impulse(512)
	let p = { fs: 44100 }
	audio.riaa(data, p)
	let hasOutput = false
	for (let v of data) if (Math.abs(v) > 1e-10) { hasOutput = true; break }
	ok(hasOutput, 'riaa produces output')
})

test('itu468 — peaked response near 6.3kHz', () => {
	let sos = audio.itu468.coefs(48000)
	is(sos.length, 3, '3 sections')
	let resp = freqz(sos, 4096, 48000)
	let db = mag2db(resp.magnitude)
	let idx2k = Math.round(2000 / (48000 / 2) * 4096)
	let idx6k = Math.round(6300 / (48000 / 2) * 4096)
	// ITU-468 peaks near 6.3kHz, significantly above 2kHz level
	ok(db[idx6k] > db[idx2k] + 3, 'ITU-468 peaks near 6.3kHz (6.3kHz: ' + db[idx6k].toFixed(1) + 'dB, 2kHz: ' + db[idx2k].toFixed(1) + 'dB)')
})

// ═══════════════════════════════════════════════════════════════════════════
// Standards calibration
// ═══════════════════════════════════════════════════════════════════════════

for (let fs of [96000, 48000, 44100]) {
	test(`itu468 ${fs}Hz — full BS.468-4 table, 31.5Hz–20kHz (rel 1kHz)`, () => {
		let sos = audio.itu468.coefs(fs)
		is(sos.length, 3, '3 sections')
		let ref = magDB(sos, 1000, fs)
		for (let [f, expected] of Object.entries(BS468)) {
			let got = magDB(sos, +f, fs) - ref
			let tol = itu468Tol(fs, +f)
			ok(Math.abs(got - expected) < tol, `ITU-468@${fs} ${f}Hz: expected ${expected}dB rel 1kHz, got ${got.toFixed(2)}dB (tol ${tol})`)
		}
	})
}

test('riaa 44100Hz — IEC 98 reference values relative to 1kHz', () => {
	let sos = audio.riaa.coefs(44100)
	let db1k = magDB(sos, 1000, 44100)
	let db20 = magDB(sos, 20, 44100)
	let db10k = magDB(sos, 10000, 44100)
	let rel20 = db20 - db1k
	ok(Math.abs(rel20 - 19.274) < 1.0, `RIAA 20Hz: expected +19.274dB rel 1kHz, got ${rel20.toFixed(3)}dB`)
	let rel10k = db10k - db1k
	ok(Math.abs(rel10k - (-13.734)) < 1.0, `RIAA 10kHz: expected -13.734dB rel 1kHz, got ${rel10k.toFixed(3)}dB`)
})

test('kWeighting 44100Hz — shelving boost near 2kHz, HPF rolls off below 100Hz', () => {
	let sos = audio.kWeighting.coefs(44100)
	let db200 = magDB(sos, 200, 44100)
	let db2k = magDB(sos, 2000, 44100)
	ok(db2k > db200, `K-weighting 2kHz (${db2k.toFixed(2)}dB) boosted vs 200Hz (${db200.toFixed(2)}dB)`)
	let db20 = magDB(sos, 20, 44100)
	ok(db20 < db200 - 3, `K-weighting 20Hz (${db20.toFixed(2)}dB) rolls off vs 200Hz (${db200.toFixed(2)}dB)`)
})

test('cWeighting 48kHz — IEC 61672 table values', () => {
	let sos = audio.cWeighting.coefs(48000)
	let table = { 31.5: -3.0, 1000: 0, 8000: -3.0 }
	for (let [f, expected] of Object.entries(table)) {
		let got = magDB(sos, +f, 48000)
		let tol = +f >= 8000 ? 1.0 : 0.5
		ok(Math.abs(got - expected) < tol, `C-weighting@48kHz ${f}Hz: expected ${expected}dB, got ${got.toFixed(2)}dB`)
	}
})

test('aWeighting 44100Hz — IEC 61672 table values', () => {
	let sos = audio.aWeighting.coefs(44100)
	let table = {
		31.5: -39.4, 63: -26.2, 125: -16.1, 250: -8.6, 500: -3.2,
		1000: 0.0, 2000: 1.2, 4000: 1.0, 8000: -1.1
	}
	for (let [f, expected] of Object.entries(table)) {
		let tol = +f <= 63 ? 2.0 : 1.5
		let got = magDB(sos, +f, 44100)
		ok(Math.abs(got - expected) < tol, `A-weighting@44100 ${f}Hz: expected ${expected}dB, got ${got.toFixed(2)}dB`)
	}
})

// ═══════════════════════════════════════════════════════════════════════════
// Cross-cutting API contract (shared by all 5 weighting filters)
// ═══════════════════════════════════════════════════════════════════════════

const FILTERS = [
	['aWeighting', audio.aWeighting, 44100, 48000],
	['cWeighting', audio.cWeighting, 44100, 96000],
	['kWeighting', audio.kWeighting, 48000, 44100],
	['itu468', audio.itu468, 48000, 96000],
	['riaa', audio.riaa, 44100, 48000]
]

test('weighting filters — all five expose .coefs as a function', () => {
	for (let [name, fn] of FILTERS)
		is(typeof fn.coefs, 'function', `${name}.coefs is a function`)
})

test('weighting filters — recompute _sos/_fs when params.fs changes mid-stream', () => {
	for (let [name, fn, fs1, fs2] of FILTERS) {
		let p = { fs: fs1 }
		fn(impulse(32), p)
		let sos1 = p._sos
		is(p._fs, fs1, `${name} caches initial fs`)
		p.fs = fs2
		fn(impulse(32), p)
		ok(p._sos !== sos1, `${name} recomputes sos on fs change ${fs1}->${fs2}`)
		is(p._fs, fs2, `${name} updates cached fs to ${fs2}`)
	}
})

test('weighting filters — dfFilter reads only .coefs/.state (params.coefs is set)', () => {
	for (let [name, fn] of FILTERS) {
		let p = {}
		fn(impulse(8), p)
		ok(p.coefs === p._sos, `${name} params.coefs aliases params._sos`)
	}
})

test('aWeighting/cWeighting — dense freqz sweep matches magDB reference (cross-check util.js vs digital-filter\'s own freqz/mag2db)', () => {
	// Both magDB (test/util.js) and freqz+mag2db (digital-filter) evaluate the
	// same biquad transfer function in closed form; comparing them at freqz's
	// own bin frequencies across a dense sweep guards against a formula
	// transcription bug in either implementation, beyond the handful of
	// discrete spec-table points checked elsewhere in this file.
	for (let fs of [44100, 48000, 96000]) {
		for (let name of ['aWeighting', 'cWeighting']) {
			let sos = audio[name].coefs(fs)
			let resp = freqz(sos, 512, fs)
			for (let i = 1; i < 512; i += 23) {
				let f = resp.frequencies[i]
				let dbFreqz = mag2db(resp.magnitude[i])
				let dbLocal = magDB(sos, f, fs)
				almost(dbFreqz, dbLocal, 1e-9, `${name}@${fs} ${f.toFixed(1)}Hz: freqz ${dbFreqz} vs magDB ${dbLocal}`)
			}
		}
	}
})
