import test, { ok, almost } from 'tst'
import * as audio from '../index.js'
import { impulse, dc, dftMag } from './util.js'

// tiny-amplitude sine, stays in the tanh nonlinearity's linear region (tanh(x)≈x for |x|≪1)
function sine (n, f, fs, amp) {
	let d = new Float64Array(n)
	for (let i = 0; i < n; i++) d[i] = (amp ?? 1) * Math.sin(2 * Math.PI * f * i / fs)
	return d
}

// steady-state gain in dB at frequency f: |DFT(output)| / |DFT(reference input)|, tail-windowed to skip the attack transient
function gainDB (fn, params, f, fs, n, amp) {
	amp = amp ?? 1e-6
	let out = sine(n, f, fs, amp)
	fn(out, params)
	let tail = out.slice(n >> 2)
	let ref = dftMag(sine(n, f, fs, amp).slice(n >> 2), f, fs)
	return 20 * Math.log10(dftMag(tail, f, fs) / ref)
}

// zero-crossing frequency estimate of a self-oscillating tail
function freqEst (data, fs, from) {
	let seg = data.slice(from)
	let crossings = 0
	for (let i = 1; i < seg.length; i++) if ((seg[i - 1] < 0) !== (seg[i] < 0)) crossings++
	return crossings / 2 * fs / seg.length
}

test('moogLadder — produces output, resonance works', () => {
	let data = impulse(512)
	audio.moogLadder(data, {fc: 1000, resonance: 0.5, fs: 44100})
	let hasOutput = data.some(x => Math.abs(x) > 0.001)
	ok(hasOutput, 'moog produces output')
	// With resonance, should ring
	let hasNeg = data.some(x => x < -0.001)
	ok(hasNeg, 'resonance causes ringing')
})

test('moogLadder — stable at high cutoff', () => {
	let data = impulse(256)
	audio.moogLadder(data, {fc: 15000, resonance: 0.8, fs: 44100})
	ok(data.every(x => isFinite(x)), 'no NaN/Inf at high cutoff')
})

test('diodeLadder — produces output', () => {
	let data = impulse(256)
	audio.diodeLadder(data, {fc: 1000, resonance: 0.5, fs: 44100})
	ok(data.some(x => Math.abs(x) > 0.001), 'output present')
})

test('korg35 — lowpass and highpass modes', () => {
	let lp = impulse(256)
	audio.korg35(lp, {fc: 1000, resonance: 0.3, fs: 44100, type: 'lowpass'})
	let hp = impulse(256)
	audio.korg35(hp, {fc: 1000, resonance: 0.3, fs: 44100, type: 'highpass'})
	ok(lp.some(x => Math.abs(x) > 0.001), 'LP output')
	ok(hp.some(x => Math.abs(x) > 0.001), 'HP output')
})

test('moogLadder — self-oscillation at resonance=1', () => {
	let data = new Float64Array(2048)
	data[0] = 0.01 // tiny impulse to start oscillation
	audio.moogLadder(data, {fc: 1000, resonance: 1, fs: 44100})
	// Check that output has sustained energy even late in the buffer
	let lateEnergy = 0
	for (let i = 1024; i < 2048; i++) lateEnergy += data[i] * data[i]
	ok(lateEnergy > 0.001, 'Moog self-oscillates at resonance=1 (late energy: ' + lateEnergy.toFixed(4) + ')')
})

test('diodeLadder — stable at high resonance', () => {
	let data = impulse(1024)
	audio.diodeLadder(data, {fc: 2000, resonance: 0.95, fs: 44100})
	ok(data.every(isFinite), 'no NaN/Inf at high resonance')
	let maxVal = 0
	for (let i = 0; i < data.length; i++) if (Math.abs(data[i]) > maxVal) maxVal = Math.abs(data[i])
	ok(maxVal < 100, 'output bounded (max: ' + maxVal.toFixed(2) + ')')
})

test('korg35 HP — attenuates DC', () => {
	let data = dc(1024)
	audio.korg35(data, {fc: 1000, resonance: 0.3, fs: 44100, type: 'highpass'})
	// Nonlinear filter: tanh saturation prevents full DC removal, but HP significantly attenuates it
	ok(Math.abs(data[1023]) < 0.5, 'Korg35 HP attenuates DC (last sample: ' + data[1023].toFixed(4) + ')')
	// HP output should be much less than input (1.0)
	ok(Math.abs(data[1023]) < Math.abs(1.0) * 0.2, 'Korg35 HP reduces DC by >80%')
})

test('moogLadder — extreme params: fc=1, res=0.99, fs=192k', () => {
	let data = impulse(256)
	audio.moogLadder(data, { fc: 1, resonance: 0.99, fs: 192000 })
	ok(data.every(isFinite), 'no NaN/Inf')
})

test('diodeLadder — extreme params: fc=1, res=0.99, fs=192k', () => {
	let data = impulse(256)
	audio.diodeLadder(data, { fc: 1, resonance: 0.99, fs: 192000 })
	ok(data.every(isFinite), 'no NaN/Inf')
})

test('korg35 — extreme params: fc=1, res=0.99, fs=192k', () => {
	let data = impulse(256)
	audio.korg35(data, { fc: 1, resonance: 0.99, fs: 192000, type: 'lowpass' })
	ok(data.every(isFinite), 'no NaN/Inf')
})

test('moogLadder — DC passthrough with resonance=0', () => {
	let data = dc(2048, 1.0)
	audio.moogLadder(data, { fc: 15000, resonance: 0, fs: 44100 })
	ok(Math.abs(data[2047]) > 0.5, `moogLadder DC output ${data[2047].toFixed(4)} > 0.5`)
	ok(isFinite(data[2047]), 'moogLadder DC output is finite')
})

test('oberheim — lowpass produces output', () => {
	let data = impulse(512)
	audio.oberheim(data, { fc: 1000, resonance: 0.5, fs: 44100, type: 'lowpass' })
	ok(data.some(x => Math.abs(x) > 0.001), 'LP output present')
})

test('oberheim — highpass attenuates DC', () => {
	let data = dc(1024)
	audio.oberheim(data, { fc: 1000, resonance: 0.3, fs: 44100, type: 'highpass' })
	ok(Math.abs(data[1023]) < 0.2, `HP attenuates DC: ${data[1023].toFixed(4)}`)
})

test('oberheim — bandpass and notch modes', () => {
	let bp = impulse(256)
	audio.oberheim(bp, { fc: 1000, resonance: 0.5, fs: 44100, type: 'bandpass' })
	ok(bp.some(x => Math.abs(x) > 0.001), 'BP output')
	let notch = impulse(256)
	audio.oberheim(notch, { fc: 1000, resonance: 0.5, fs: 44100, type: 'notch' })
	ok(notch.some(x => Math.abs(x) > 0.001), 'Notch output')
})

test('oberheim — stable at high resonance', () => {
	let data = impulse(1024)
	audio.oberheim(data, { fc: 2000, resonance: 0.95, fs: 44100 })
	ok(data.every(isFinite), 'no NaN/Inf at high resonance')
})

test('oberheim — extreme params: fc=1, res=0.99, fs=192k', () => {
	let data = impulse(256)
	audio.oberheim(data, { fc: 1, resonance: 0.99, fs: 192000 })
	ok(data.every(isFinite), 'no NaN/Inf')
})

// --- drive: params.drive != null (falsy 0 must be honored, like resonance) ---

test('moogLadder — drive:0 disables input saturation (not coerced to default 1)', () => {
	// audit finding: `params.drive || 1` silently turned drive:0 into drive:1;
	// fixed to `?? 1`. tanh(0*u)=0, so drive:0 must differ from drive:1/5.
	let d0 = impulse(64); audio.moogLadder(d0, { fc: 1000, resonance: 0, fs: 44100, drive: 0 })
	let d1 = impulse(64); audio.moogLadder(d1, { fc: 1000, resonance: 0, fs: 44100, drive: 1 })
	let d5 = impulse(64); audio.moogLadder(d5, { fc: 1000, resonance: 0, fs: 44100, drive: 5 })
	ok(!d0.every((x, i) => x === d1[i]), 'drive:0 differs from drive:1')
	ok(d0.every(x => x === 0), 'drive:0 -> tanh(0)=0, silence')
	ok(!d1.every((x, i) => x === d5[i]), 'drive:1 differs from drive:5 (drive is live)')
})

test('diodeLadder — drive parameter has an effect (was a no-op)', () => {
	let d0 = impulse(64); audio.diodeLadder(d0, { fc: 1000, resonance: 0.3, fs: 44100, drive: 0 })
	let d1 = impulse(64); audio.diodeLadder(d1, { fc: 1000, resonance: 0.3, fs: 44100, drive: 1 })
	let d5 = impulse(64); audio.diodeLadder(d5, { fc: 1000, resonance: 0.3, fs: 44100, drive: 5 })
	ok(!d0.every((x, i) => x === d1[i]), 'drive:0 differs from drive:1')
	ok(!d1.every((x, i) => x === d5[i]), 'drive:1 differs from drive:5')
})

test('korg35 — drive parameter has an effect (was a no-op)', () => {
	let d0 = impulse(64); audio.korg35(d0, { fc: 1000, resonance: 0.3, fs: 44100, drive: 0 })
	let d1 = impulse(64); audio.korg35(d1, { fc: 1000, resonance: 0.3, fs: 44100, drive: 1 })
	let d5 = impulse(64); audio.korg35(d5, { fc: 1000, resonance: 0.3, fs: 44100, drive: 5 })
	ok(!d0.every((x, i) => x === d1[i]), 'drive:0 differs from drive:1')
	ok(!d1.every((x, i) => x === d5[i]), 'drive:1 differs from drive:5')
})

// --- korg35 LP+HP complementarity: exact only at resonance=0 ---

test('korg35 — LP+HP = input exactly at resonance=0 (complementary)', () => {
	// HP = data[i]-(1+k)*y2 with k=2*res (korg35.js), so LP+HP=input-k*LP holds
	// exactly only when k=0. Verified in the tanh linear region (amp≪1).
	let fs = 44100, fc = 1000, amp = 1e-6, n = 8192
	for (let f of [200, 500, 1000, 2000, 5000]) {
		let lp = sine(n, f, fs, amp); audio.korg35(lp, { fc, resonance: 0, fs, type: 'lowpass' })
		let hp = sine(n, f, fs, amp); audio.korg35(hp, { fc, resonance: 0, fs, type: 'highpass' })
		let x = sine(n, f, fs, amp)
		let maxErr = 0
		for (let i = n >> 1; i < n; i++) maxErr = Math.max(maxErr, Math.abs((lp[i] + hp[i] - x[i]) / amp))
		ok(maxErr < 1e-9, `LP+HP=input at f=${f} (maxErr=${maxErr.toExponential(2)})`)
	}
})

// --- diode-ladder genuinely differs from moog-ladder (was bit-identical) ---

test('diodeLadder — differs from moogLadder in the linear regime (distinct topology)', () => {
	// diode-ladder's stages load each other (tridiagonal solve); moog-ladder's
	// stages are isolated by unity buffers (simple cascade) — the two must
	// produce different magnitude responses even at vanishing amplitude,
	// where tanh(x)≈x makes both filters purely linear.
	let fs = 44100, fc = 1000, amp = 1e-6, n = 16384
	let sawDiff = false
	for (let res of [0, 0.5, 0.8]) {
		for (let f of [500, 1000, 2000]) {
			let dDb = gainDB(audio.diodeLadder, { fc, resonance: res, fs }, f, fs, n, amp)
			let mDb = gainDB(audio.moogLadder, { fc, resonance: res, fs }, f, fs, n, amp)
			if (Math.abs(dDb - mDb) > 0.05) sawDiff = true
		}
	}
	ok(sawDiff, 'diodeLadder and moogLadder magnitude responses differ by >0.05dB somewhere in the linear regime')
})

test('diodeLadder — retains more bass than moogLadder at the same resonance (documented character)', () => {
	// Closed form (see diode-ladder.js derivation): DC steady-state output is
	// data/(1+k) for the diode ladder vs data/(1+k*(1+G+G²+G³+G⁴)) for moog-ladder
	// (k=4·resonance) — diode's denominator is strictly smaller for any res>0,
	// so it always passes more low-frequency energy at equal resonance.
	let amp = 1e-6, n = 4000
	for (let res of [0.3, 0.5, 0.8]) {
		let d = dc(n, amp); audio.diodeLadder(d, { fc: 1000, resonance: res, fs: 44100 })
		let m = dc(n, amp); audio.moogLadder(m, { fc: 1000, resonance: res, fs: 44100 })
		ok(d[n - 1] > m[n - 1], `res=${res}: diode DC gain ${(d[n-1]/amp).toFixed(4)} > moog DC gain ${(m[n-1]/amp).toFixed(4)}`)
	}
})

// --- cutoff / slope (readme: -24dB/oct) ---

test('moogLadder — exact -3.01dB per stage at fc, resonance=0 (tan-prewarped bilinear match)', () => {
	// The tan-prewarped TPT one-pole matches its analog RC prototype exactly at
	// the design frequency: -3.0103dB (=20*log10(1/√2)) per stage (Zavalishin,
	// "The Art of VA Filter Design", Ch. 2-3). 4 cascaded stages -> 4x in dB.
	let db = gainDB(audio.moogLadder, { fc: 1000, resonance: 0, fs: 44100 }, 1000, 44100, 32768)
	almost(db, 4 * -3.0103, 0.01, `moogLadder gain at fc = ${db.toFixed(4)}dB`)
})

test('moogLadder & diodeLadder — asymptotic -24dB/octave slope (readme claim, resonance=0)', () => {
	// Each TPT one-pole approaches -6dB/octave far above its cutoff (Zavalishin
	// Ch.3); 4 cascaded/coupled stages -> -24dB/octave. fc kept low (200Hz) so
	// the measured octave (2kHz->4kHz) sits far from Nyquist, where the
	// digital response is closest to this analog asymptote.
	let fc = 200, fs = 44100, n = 65536
	for (let fn of [audio.moogLadder, audio.diodeLadder]) {
		let db1 = gainDB(fn, { fc, resonance: 0, fs }, 2000, fs, n)
		let db2 = gainDB(fn, { fc, resonance: 0, fs }, 4000, fs, n)
		almost(db2 - db1, -24, 2, `${fn.name} slope 2k->4k = ${(db2-db1).toFixed(2)}dB/oct`)
	}
})

test('diodeLadder — has a well-defined -3dB cutoff below fc (stage loading adds attenuation)', () => {
	// diode-ladder's inter-stage coupling (a=G·C≥0 in the tridiagonal system)
	// can only add attenuation relative to moog-ladder's unbuffered cascade at
	// the same fc, so its -3dB point must sit at or below moog-ladder's.
	let fc = 1000, fs = 44100, n = 32768
	function find3dB (fn) {
		let lo = 1, hi = fc
		for (let i = 0; i < 30; i++) {
			let mid = (lo + hi) / 2
			if (gainDB(fn, { fc, resonance: 0, fs }, mid, fs, n) > -3) lo = mid; else hi = mid
		}
		return (lo + hi) / 2
	}
	let moogF3 = find3dB(audio.moogLadder)
	let diodeF3 = find3dB(audio.diodeLadder)
	ok(diodeF3 > 0 && diodeF3 < fc, `diode -3dB point ${diodeF3.toFixed(1)}Hz is within (0, fc)`)
	ok(diodeF3 <= moogF3, `diode -3dB point ${diodeF3.toFixed(1)}Hz <= moog's ${moogF3.toFixed(1)}Hz`)
})

// --- self-oscillation: frequency tracking + honest per-filter characterization ---

test('moogLadder — self-oscillation frequency tracks fc within 1%', () => {
	// Stilson & Smith, "Analyzing the Moog VCF" (1996): self-oscillation pitch
	// tracks the cutoff control almost exactly.
	for (let fc of [200, 1000, 5000]) {
		let d = new Float64Array(8192); d[0] = 0.01
		audio.moogLadder(d, { fc, resonance: 1, fs: 44100 })
		let f = freqEst(d, 44100, 4096)
		almost(f, fc, fc * 0.01, `moog self-osc freq ${f.toFixed(1)}Hz tracks fc=${fc}`)
	}
})

test('diodeLadder — self-oscillation frequency tracks fc (looser tolerance, coupled topology)', () => {
	// diode-ladder's per-stage tanh damping shifts the resonant frequency
	// somewhat from fc (see below: it also self-oscillates at a higher
	// resonance than moog) — still tracks fc, just less tightly.
	for (let fc of [200, 1000, 5000]) {
		let d = new Float64Array(16384); d[0] = 0.01
		audio.diodeLadder(d, { fc, resonance: 1.5, fs: 44100 })
		let f = freqEst(d, 44100, 12000)
		almost(f, fc, fc * 0.1, `diode self-osc freq ${f.toFixed(1)}Hz tracks fc=${fc}`)
	}
})

test('diodeLadder — self-oscillates at a higher resonance than moogLadder (honest threshold)', () => {
	// The per-stage tanh adds extra damping vs. moog-ladder's single input-only
	// tanh, pushing the self-oscillation onset above resonance=1.
	let below = new Float64Array(16384); below[0] = 0.01
	audio.diodeLadder(below, { fc: 1000, resonance: 1, fs: 44100 })
	let above = new Float64Array(16384); above[0] = 0.01
	audio.diodeLadder(above, { fc: 1000, resonance: 1.5, fs: 44100 })
	let lateBelow = 0, lateAbove = 0
	for (let i = 12000; i < 16384; i++) { lateBelow += below[i] * below[i]; lateAbove += above[i] * above[i] }
	ok(lateBelow < 1e-6, `resonance=1 has decayed (late energy=${lateBelow.toExponential(2)})`)
	ok(lateAbove > 0.01, `resonance=1.5 sustains (late energy=${lateAbove.toFixed(4)})`)
})

test('korg35 — never self-oscillates, at any resonance (docstring corrected)', () => {
	// 2 real poles in the resonance loop can reach at most -180° phase only as
	// frequency->infinity, where gain->0, so the Barkhausen self-oscillation
	// criterion (unity loop gain at -180°) is never met at a finite, audible
	// frequency — unlike moog/diode-ladder's 4 poles. Verified: energy decays
	// to noise floor even far past resonance=1.
	for (let res of [1, 2, 5]) {
		let d = new Float64Array(8192); d[0] = 0.01
		audio.korg35(d, { fc: 1000, resonance: res, fs: 44100 })
		let lateEnergy = 0
		for (let i = 4096; i < 8192; i++) lateEnergy += d[i] * d[i]
		ok(lateEnergy < 1e-6, `korg35 resonance=${res} decays (late energy=${lateEnergy.toExponential(2)})`)
	}
})

// --- oberheim: notch null / bandpass peak numeric (SVF theory) ---

test('oberheim — notch null and bandpass peak match SVF theory at fc', () => {
	// Standard 2-pole SVF (Zavalishin Ch.4): bandpass gain at the center
	// frequency is exactly 1/(2R) with R=1-resonance; the notch (hp+lp) has an
	// exact null at the center frequency (cancellation in continuous time).
	let fc = 1000, fs = 44100, amp = 1e-6, n = 32768
	for (let res of [0.3, 0.5, 0.8]) {
		let R = 1 - res
		let bpDb = gainDB(audio.oberheim, { fc, resonance: res, fs, type: 'bandpass' }, fc, fs, n, amp)
		almost(bpDb, 20 * Math.log10(1 / (2 * R)), 1e-4, `bandpass peak at res=${res}`)
		let notchDb = gainDB(audio.oberheim, { fc, resonance: res, fs, type: 'notch' }, fc, fs, n, amp)
		ok(notchDb < -150, `notch null at res=${res}: ${notchDb.toFixed(1)}dB`)
	}
})

// --- split-block state continuity (params._s must persist across calls) ---

test('analog filters — state persists across split process() calls', () => {
	let params = { fc: 1000, resonance: 0.5, fs: 44100 }
	for (let fn of [audio.moogLadder, audio.diodeLadder, audio.korg35, audio.oberheim]) {
		let n = 1024
		let full = sine(n, 300, 44100, 0.3)
		fn(full, { ...params })

		let split = sine(n, 300, 44100, 0.3)
		let p = { ...params }
		fn(split.subarray(0, 400), p)
		fn(split.subarray(400), p)

		let maxDiff = 0
		for (let i = 0; i < n; i++) maxDiff = Math.max(maxDiff, Math.abs(full[i] - split[i]))
		ok(maxDiff < 1e-12, `${fn.name}: one-shot vs split-call outputs match (maxDiff=${maxDiff.toExponential(2)})`)
	}
})

// --- coefficients recompute when fc/resonance change mid-stream ---

test('analog filters — coefficients recompute when fc changes mid-stream on a persisted params object', () => {
	let f = 1500, fs = 44100, n = 8192
	for (let fn of [audio.moogLadder, audio.diodeLadder, audio.korg35, audio.oberheim]) {
		let constFc = sine(n, f, fs, 1e-4)
		fn(constFc, { fc: 1000, resonance: 0, fs })

		let droppedFc = sine(n, f, fs, 1e-4)
		let p = { fc: 1000, resonance: 0, fs }
		fn(droppedFc.subarray(0, n / 2), p)
		p.fc = 100
		fn(droppedFc.subarray(n / 2), p)

		let tail = 2000
		let magConst = dftMag(constFc.slice(n - tail), f, fs)
		let magDropped = dftMag(droppedFc.slice(n - tail), f, fs)
		ok(magDropped < magConst * 0.5, `${fn.name}: dropping fc to 100 mid-stream attenuates ${f}Hz further (const=${magConst.toExponential(2)}, dropped=${magDropped.toExponential(2)})`)
	}
})

// --- out-of-range resonance stays bounded ---

test('analog filters — bounded output for out-of-range resonance (negative or >1)', () => {
	for (let fn of [audio.moogLadder, audio.diodeLadder, audio.korg35, audio.oberheim]) {
		for (let resonance of [-2, -0.5, 1.5, 5, 10]) {
			let data = impulse(2048)
			fn(data, { fc: 1000, resonance, fs: 44100 })
			ok(data.every(isFinite), `${fn.name} resonance=${resonance}: finite`)
			ok(data.every(x => Math.abs(x) < 10), `${fn.name} resonance=${resonance}: bounded`)
		}
	}
})
