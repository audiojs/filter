// The /audio manifests as a host drives them: a stub ctx (CONTRACT.md, Context), process() called in blocks, numbers as
// 1-length Float32Arrays. Each against its kernel's direct call; each tail against the rings it leaves (util.js rings);
// each process() for what it allocates (util.js collections).
import test, { ok, is } from 'tst'
import { fileURLToPath } from 'node:url'
import { rings, collections } from './util.js'
import * as biquadAtoms from '@audio/filter-biquad/audio'
import { variable } from '@audio/filter-variable/audio'
import { dcblocker } from '@audio/filter-dcblocker/audio'
import { derivative, integral } from '@audio/filter-derivative/audio'
import { emphasis, deemphasis } from '@audio/filter-preemphasis/audio'
import { moog } from '@audio/filter-moog-ladder/audio'
import { diode } from '@audio/filter-diode-ladder/audio'
import { korg35 } from '@audio/filter-korg35/audio'
import { oberheim } from '@audio/filter-oberheim/audio'
import { resonator } from '@audio/filter-resonator/audio'
import { comb } from '@audio/filter-comb/audio'
import { spectralTilt } from '@audio/filter-spectral-tilt/audio'
import { combBlock } from '@audio/filter-comb'
import * as K from '../index.js'

const seeded = seed => { let r = seed >>> 0; return () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296 }
const live = (m, set) => Object.fromEntries(Object.entries(m.params).map(([k, s]) => [k, s.type === 'number' ? Float32Array.of(set[k] ?? s.default) : set[k] ?? s.default]))
// A value at random in a declared range: its min a tenth of the time, its max a tenth, its default a twentieth, else
// uniform (log-uniform on a log curve); an enum's values evenly; a stepped number on its step
const pick = (u, s) => {
	if (s.type === 'enum') return s.values[Math.floor(u() * s.values.length)]
	let r = u(), v = r < 0.1 ? s.min : r < 0.2 ? s.max : r < 0.25 ? s.default : s.curve === 'log' ? s.min * (s.max / s.min) ** u() : s.min + (s.max - s.min) * u()
	return s.step ? s.min + s.step * Math.round((v - s.min) / s.step) : v
}
const setting = (m, u) => Object.fromEntries(Object.entries(m.params).map(([k, s]) => [k, pick(u, s)]))

// x through the manifest in place: one channel, calls of `block` frames (a function of the call's index), `set(i)`
// the values of call i
function host (m, x, fs, set, block = () => 128) {
	let proc = m({ sampleRate: fs, maxBlockSize: 1024, maxChannels: 2, params: live(m, set(0)), buffers: {} })
	let a = Float32Array.from(x), y = new Float32Array(x.length)
	for (let pos = 0, i = 0; pos < x.length; i++) {
		let n = Math.min(block(i), x.length - pos)
		proc([[a.subarray(pos, pos + n)]], [[y.subarray(pos, pos + n)]], live(m, set(i)))
		pos += n
	}
	x.set(y)
	return x
}

// The kernels as their direct call takes them, each manifest's params mapped onto its options
const KERNEL = {
	lowpass: [K.lowpass, (fs, p) => ({ fs, fc: p.fc, Q: p.Q })],
	highpass: [K.highpass, (fs, p) => ({ fs, fc: p.fc, Q: p.Q })],
	bandpass: [K.bandpass, (fs, p) => ({ fs, fc: p.fc, Q: p.Q })],
	variable: [K.variableBandwidth, (fs, p) => ({ fs, fc: p.fc, Q: p.Q, type: p.type })],
	dcblocker: [K.dcBlocker, (fs, p) => ({ R: p.R })],
	derivative: [K.derivative, () => ({})],
	integral: [K.integral, (fs, p) => ({ leak: p.leak })],
	emphasis: [K.emphasis, (fs, p) => ({ alpha: p.alpha })],
	deemphasis: [K.deemphasis, (fs, p) => ({ alpha: p.alpha })],
	moog: [K.moogLadder, (fs, p) => ({ fs, fc: p.fc, resonance: p.resonance, drive: p.drive, type: p.type, poles: p.poles })],
	diode: [K.diodeLadder, (fs, p) => ({ fs, fc: p.fc, resonance: p.resonance, drive: p.drive })],
	korg35: [K.korg35, (fs, p) => ({ fs, fc: p.fc, resonance: p.resonance, drive: p.drive, type: p.type })],
	oberheim: [K.oberheim, (fs, p) => ({ fs, fc: p.fc, resonance: p.resonance, type: p.type })],
	resonator: [K.resonator, (fs, p) => ({ fs, fc: p.fc, bw: p.bw })],
	spectralTilt: [K.spectralTilt, (fs, p) => ({ fs, slope: p.slope })],
}
const ATOMS = { ...biquadAtoms, variable, dcblocker, derivative, integral, emphasis, deemphasis, moog, diode, korg35, oberheim, resonator, spectralTilt }
const ALL = { ...ATOMS, comb }
const LADDERS = new Set(['moog', 'diode', 'korg35', 'oberheim'])
// the values each manifest glides sample by sample (a value that scales the signal): their own test below
const GLIDED = { emphasis: ['alpha'], deemphasis: ['alpha'], spectralTilt: ['slope'], comb: ['gain'] }

test('audio.js – a host\'s blocks, its values moving between calls, give the kernel\'s direct calls, bit for bit', () => {
	for (let [name, m] of Object.entries(ATOMS)) {
		let [kernel, opts] = KERNEL[name], u = seeded(name.length)
		for (let fs of [44100, 96000]) {
			// a setting per call, in the declared ranges (frequencies under 0.49 of the rate, where none is held), float32 as a
			// host gives them; moog's poles on its steps. Enums held through a run: a change of type fades (its own test); so
			// are the values a manifest glides sample by sample (their own test)
			let held = Object.fromEntries(Object.entries(m.params).filter(([k, s]) => s.type === 'enum' || s.step || GLIDED[name]?.includes(k)).map(([k, s]) => [k, s.type === 'number' ? Math.fround(pick(u, s)) : pick(u, s)]))
			let sets = Array.from({ length: 64 }, () => Object.fromEntries(Object.entries(m.params).map(([k, s]) =>
				[k, k in held ? held[k] : Math.fround(Math.min(s.curve === 'log' ? s.min * (s.max / s.min) ** u() : s.min + (s.max - s.min) * u(), k === 'fc' ? 0.49 * fs : Infinity))])))
			let x = Float64Array.from({ length: 6000 }, (_, i) => 0.5 * Math.sin(i * 0.05) + 0.3 * (u() - 0.5)), sizes = [], at = 0
			for (let i = 0; at < x.length; i++) { sizes.push(1 + Math.floor(u() * 300)); at += sizes[i] }
			let got = host(m, Float64Array.from(x), fs, i => sets[i], i => sizes[i])
			let want = Float32Array.from(x), p = {}
			for (let i = 0, pos = 0; pos < x.length; pos += sizes[i++]) { Object.assign(p, opts(fs, sets[i])); kernel(want.subarray(pos, pos + sizes[i]), p) }
			ok(got.every((v, i) => Object.is(v, want[i])), `${name} at ${fs}: the kernel's output`)
		}
	}
})

test('moog audio.js – poles between its steps (2 and 4) takes the nearer, as a host on its step does', () => {
	let x = Float64Array.from({ length: 2048 }, (_, i) => Math.sin(i * 0.1))
	for (let [v, on] of [[2.03, 2], [2.99, 2], [3, 4], [3.97, 4]]) {
		let off = host(moog, Float64Array.from(x), 44100, () => ({ poles: v })), step = host(moog, Float64Array.from(x), 44100, () => ({ poles: on }))
		ok(off.every((s, i) => Object.is(s, step[i])), `poles ${v} sounds as ${on}`)
	}
})

// CONTRACT.md, process: never write NaN or Infinity. Every value of every range at every rate a host may run: each number
// param at its min and at its max (the others at their defaults), each enum value, and 50 settings at random; full-scale
// noise in, 2 channels, calls of 128 frames
test('audio.js – every processor writes finite numbers for noise in, at the ends of its ranges and 50 points between, 8 to 192 kHz', () => {
	let u = seeded(7), noise = Float32Array.from({ length: 4096 }, () => u() * 2 - 1)
	for (let [name, m] of Object.entries(ALL)) {
		let sets = [{}]
		for (let [k, s] of Object.entries(m.params)) {
			if (s.type === 'number') sets.push({ [k]: s.min }, { [k]: s.max })
			else for (let v of s.values) sets.push({ [k]: v })
		}
		for (let i = 0; i < 50; i++) sets.push(setting(m, u))
		let bad = []
		for (let fs of [8000, 22050, 44100, 48000, 96000, 192000]) for (let set of sets) {
			let l = live(m, set), p = m({ sampleRate: fs, maxBlockSize: 128, maxChannels: 2, params: l, buffers: {} })
			let y = [new Float32Array(noise.length), new Float32Array(noise.length)]
			for (let pos = 0; pos < noise.length; pos += 128) p([[noise.subarray(pos, pos + 128), noise.subarray(pos, pos + 128)]], [y.map(c => c.subarray(pos, pos + 128))], l)
			if (!y.every(c => c.every(Number.isFinite))) bad.push(`${JSON.stringify(set)} at ${fs}`)
		}
		ok(!bad.length, `${name}: finite at ${sets.length} settings x 6 rates${bad.length ? `; not at ${bad.length}, e.g. ${bad[0]}` : ''}`)
	}
})

// The declared tail against the rings each processor leaves (util.js rings: an impulse, the validator's noise burst, a
// DC step, held tones, each to 60 dB under the input's level): never short, and at most 1.5 times the longest ring where
// that is over 128 frames. Random settings in the ranges at 44.1, 48 and 96 kHz; tones about fc (held as the processor
// holds it), at the comb's peaks, and over the spectrum. The ladders at 1e-3, where tanh is x and the tail's linear
// model holds, and driven at full scale, where the bound is measured: never short there either
test('audio.js – each tail: never short of the rings of an impulse, noise, a DC step and held tones; at most 1.5 times the longest', () => {
	let rates = [44100, 48000, 96000], report = []
	for (let [name, m] of Object.entries(ALL)) {
		let u = seeded(name.length * 31), worst = 0, n = 0, skipped = 0, inf = 0, bad = []
		for (let si = 0; si < 12; si++) {
			let fs = rates[si % 3], set = setting(m, u), l = live(m, set)
			let T = m.tail ? m.tail({ sampleRate: fs, params: l, buffers: {} }) * fs : 0
			if (T === Infinity) { inf++; continue }
			if (T > 0.5 * fs) { skipped++; continue }   // rings past half a second: the tail tests of each package's rule cover them
			let fc = set.fc != null ? Math.min(set.fc, 0.49 * fs) : 0, comb = name === 'comb' ? 1000 / set.delay : 0
			let freqs = [...fc ? [0.8, 0.9, 0.95, 1, 1.05, 1.1, 1.25].map(k => k * fc) : [], ...comb ? [0.5, 1, 1.5, 2, 3].map(k => k * comb) : [],
				...Array.from({ length: 12 }, (_, i) => 10 * (0.45 * fs / 10) ** (i / 11))]
			for (let amp of LADDERS.has(name) ? [1e-3, 1] : [1]) {
				let r = rings(x => host(m, x, fs, () => set), T, { fs, freqs, amp })
				if (r.short || (amp < 1 || !LADDERS.has(name)) && r.over > 1.5) bad.push(`${JSON.stringify(set)} at ${fs}, level ${amp}: tail ${Math.round(T)} frames, rings impulse ${r.impulse} dc ${r.dc} tone ${r.tone} noise ${r.noise}`)
				if (amp < 1 || !LADDERS.has(name)) worst = Math.max(worst, r.over)
			}
			n++
		}
		ok(!bad.length, `${name}: ${n} settings measured (${inf} Infinity, ${skipped} past 0.5 s), tail at most ${worst.toFixed(2)} of the longest ring${bad.length ? `; ${bad.length} off: ${bad[0]}` : ''}`)
	}
	// a ring that never ends: the integral's sum at leak 1, a ladder self-oscillating, the SVF undamped
	is(integral.tail({ sampleRate: 44100, params: live(integral, { leak: 1 }) }), Infinity, 'integral at leak 1: Infinity')
	is(moog.tail({ sampleRate: 44100, params: live(moog, { resonance: 1 }) }), Infinity, 'moog at resonance 1: Infinity')
	is(oberheim.tail({ sampleRate: 44100, params: live(oberheim, { resonance: 1 }) }), Infinity, 'oberheim at resonance 1: Infinity')
	ok(!emphasis.tail && !derivative.tail, 'emphasis and derivative ring one sample: no tail')
})

// A change of type (or of moog's pole count) through a 220 Hz tone, at instants off any block grid: the largest second
// difference over the change, against the larger of the same before it and once settled after it (the stage B jump
// measure; a tap switched in one sample read x254 for moog's poles). Fading, a type change reads as a level that moves
// between two settled ones, x1; and how a host cuts its calls does not change a sample
test('moog, korg35, oberheim, variable audio.js – a new type or pole count fades: no step, and the same whatever the calls', () => {
	let fs = 44100, N = 2 * fs, x = Float64Array.from({ length: N }, (_, i) => 0.5 * Math.sin(2 * Math.PI * 220 * i / fs))
	let d2 = (y, a, b) => { let m = 0; for (let i = Math.max(a, 2); i < b; i++) m = Math.max(m, Math.abs(y[i] - 2 * y[i - 1] + y[i - 2])); return m }
	for (let [m, base, change] of [[moog, { fc: 1000 }, { poles: 2 }], [moog, { fc: 1000 }, { type: 'highpass' }], [moog, { fc: 1000, poles: 2 }, { type: 'bandpass', poles: 4 }],
		[korg35, { fc: 1000 }, { type: 'highpass' }], [korg35, { fc: 1000, resonance: 0.5, type: 'highpass' }, { type: 'lowpass' }],
		[oberheim, { fc: 1000 }, { type: 'highpass' }], [oberheim, { fc: 1000, resonance: 0.5 }, { type: 'notch' }],
		[variable, { fc: 1000 }, { type: 'highpass' }], [variable, { fc: 300, Q: 8, type: 'bandpass' }, { type: 'lowpass' }]]) {
		let label = `${m.name} ${JSON.stringify(base)} → ${JSON.stringify(change)}`, ref = host(m, Float64Array.from(x), fs, () => base), most = 0
		for (let at of [9001, 13007, 17011, 21013]) {
			let cut = i => i === 0 ? at : 128, set = i => i === 0 ? base : { ...base, ...change }
			let y = host(m, Float64Array.from(x), fs, set, cut)
			most = Math.max(most, d2(y, at, at + 30000) / Math.max(d2(ref, at - 4096, at), d2(y, at + 30000, at + 34096)))
			for (let block of [1, 7, 1024]) {
				let z = host(m, Float64Array.from(x), fs, i => i * block < at ? base : { ...base, ...change }, i => i * block < at && (i + 1) * block > at ? at - i * block : block)
				ok(z.every((v, i) => Object.is(v, y[i])), `${label}: calls of ${block} frames give the same, bit for bit`)
			}
		}
		ok(most < 1.5, `${label}: x${most.toFixed(2)} over the change`)
	}
	// a change while a fade is under way starts the next from where the output is: still no step
	let set = i => i < 10 ? { fc: 1000 } : i < 20 ? { fc: 1000, type: 'highpass' } : { fc: 1000, type: 'bandpass' }
	let y = host(moog, Float64Array.from(x), fs, set, () => 32), ref = host(moog, Float64Array.from(x), fs, () => ({ fc: 1000 }))
	ok(d2(y, 320, 40000) / Math.max(d2(ref, 0, 320), d2(y, 40000, 44096)) < 1.5, 'moog: a type change 10 ms into a fade, x1')
	y = host(variable, Float64Array.from(x), fs, set, () => 32), ref = host(variable, Float64Array.from(x), fs, () => ({ fc: 1000 }))
	ok(d2(y, 320, 40000) / Math.max(d2(ref, 0, 320), d2(y, 40000, 44096)) < 1.5, 'variable: a type change 10 ms into a fade, x1')
	// variable's fade is the blend of the two types' own renders, each run from the start (the three types share one
	// denominator, so the history the fade's new type takes up is that type's own): (1 − e)·old + e·new, e = t²(3 − 2t)
	// over 0.02·fs frames. Within the float32 roundings of the three renders and the direct form's own (4 · 2^-24 of the
	// peak)
	for (let [base, to] of [[{ fc: 1000 }, 'highpass'], [{ fc: 20, Q: 30 }, 'highpass'], [{ fc: 15000, Q: 5, type: 'bandpass' }, 'lowpass'], [{ fc: 200, Q: 2, type: 'highpass' }, 'bandpass']]) {
		let at = 9001, L = 0.02 * fs, A = host(variable, Float64Array.from(x), fs, () => base), B = host(variable, Float64Array.from(x), fs, () => ({ ...base, type: to }))
		let z = host(variable, Float64Array.from(x), fs, i => i === 0 ? base : { ...base, type: to }, i => i === 0 ? at : 128), err = 0, peak = 0
		for (let i = 0; i < x.length; i++) {
			let t = i < at ? 0 : Math.min(1, (i - at) / L), e = t * t * (3 - 2 * t)
			err = Math.max(err, Math.abs(z[i] - ((1 - e) * A[i] + e * B[i]))); peak = Math.max(peak, Math.abs(A[i]), Math.abs(B[i]))
		}
		ok(err <= 4 * 2 ** -24 * peak, `variable ${JSON.stringify(base)} → ${to}: the blend of the two renders, within ${(err / peak / 2 ** -24).toFixed(2)} · 2^-24 of the peak`)
	}
})

// A value that scales the signal glides: comb's gain, emphasis's and de-emphasis's alpha (each scales a sample), and
// spectral tilt's slope (it sets the gain each stage gives above its corner, 10^(slope/20), and moves no pole). A host
// ramps such a value in calls of 32 frames, each handed the value at its first frame (CONTRACT.md: Parameters, Time);
// the value read at frame n is the line through those values, each at its call's first frame, played 32 frames late:
// u(n) = v_k + (v_k+1 − v_k)·(n − 32 − p_k)/32 for p_k ≤ n − 32 < p_k + 32, v_0 before. A value held a call is the
// value. Each frame is computed here from the processor's own equation at u(n), bit for bit: comb feedforward
// y = x + u·x[n − M], emphasis y = x − u·x[n − 1], de-emphasis y = x + u·y[n − 1] (y kept in double), spectral tilt's
// stages (poles e^(−2π·62.5·2^j/fs) under fs/2) s = a·s + (1 − a)·x, x = s + (x − s)·10^(u/20), and at a slope held at 0
// the input as it is while each stage's one-pole follows it. The values: held, a 20 ms ramp, held, a jump back with no ramp
test('comb, emphasis, deemphasis, spectralTilt audio.js – a value that scales the signal glides: each frame the equation at the host\'s line, 32 frames late, bit for bit', () => {
	let fs = 48000, u = seeded(9), N = 4096, calls = N / 32, x = Float32Array.from({ length: N }, (_, i) => 0.5 * Math.sin(2 * Math.PI * 220 * i / fs) + 0.2 * (u() - 0.5))
	let plan = (a, b) => Array.from({ length: calls }, (_, i) => Math.fround(i < 20 ? a : i < 50 ? a + (b - a) * (i - 20) / 30 : i < 80 ? b : a))
	let line = (v, n) => { let t = n - 32; if (t < 0) return v[0]; let k = Math.floor(t / 32), q = t - 32 * k; return k + 1 < v.length ? v[k] + (v[k + 1] - v[k]) * q / 32 : v[v.length - 1] }
	let poles = []
	for (let j = 0; j < 8; j++) if (62.5 * 2 ** j < fs / 2) poles.push(Math.exp(-2 * Math.PI * (62.5 * 2 ** j) / fs))
	for (let [m, key, base, v, equation] of [
		[comb, 'gain', { delay: 10, type: 'feedforward' }, plan(-0.5, 0.9), (v, held) => { let y = new Float32Array(N); for (let n = 0; n < N; n++) y[n] = x[n] + line(v, n) * (n < 480 ? 0 : x[n - 480]); return y }],
		[emphasis, 'alpha', {}, plan(0.6, 0.95), v => { let y = new Float32Array(N); for (let n = 0; n < N; n++) y[n] = x[n] - line(v, n) * (n ? x[n - 1] : 0); return y }],
		[deemphasis, 'alpha', {}, plan(0.6, 0.95), v => { let y = new Float32Array(N), y1 = 0; for (let n = 0; n < N; n++) y[n] = y1 = x[n] + line(v, n) * y1; return y }],
		[spectralTilt, 'slope', {}, plan(0, 3), (v, held) => {
			let y = new Float32Array(N), s = new Float64Array(poles.length)
			for (let n = 0; n < N; n++) {
				let w = x[n], k = n >> 5
				if (held(k) && v[k] === 0) { for (let j = 0; j < poles.length; j++) s[j] = poles[j] * s[j] + (1 - poles[j]) * w; y[n] = w; continue }
				let g = Math.pow(10, line(v, n) / 20)
				for (let j = 0; j < poles.length; j++) { s[j] = poles[j] * s[j] + (1 - poles[j]) * w; w = s[j] + (w - s[j]) * g }
				y[n] = w
			}
			return y
		}]]) {
		let got = host(m, Float64Array.from(x), fs, i => ({ ...base, [key]: v[i] }), () => 32), want = equation(v, k => k === 0 || v[k] === v[k - 1])
		ok(got.every((y, i) => Object.is(y, want[i])), `${m.id ?? m.name}: ${key} ${v[0]} → ${v[50]} over 20 ms and back at once, each frame the equation at the line`)
	}
})

// The comb's delay is live, read as @audio/effect's delay lines read theirs (comb.js). Expected values from the comb's
// equations computed here: feedforward y[n] = x[n] + g·x[n − d], feedback y[n] = x[n] + g·y[n − d] (the line holds y in
// double, as the kernel's does; out as float32)
test('comb audio.js – delay live: whole frames bit for bit, between frames read between them, a move glides at a bounded speed', () => {
	let fs = 48000, u = seeded(3), x = Float32Array.from({ length: 20000 }, () => u() - 0.5)
	let equation = (type, M, g) => {
		let y = new Float64Array(x.length)
		for (let i = 0; i < x.length; i++) y[i] = x[i] + g * (i < M ? 0 : type === 'feedback' ? y[i - M] : x[i - M])
		return Float32Array.from(y)
	}
	for (let type of ['feedforward', 'feedback']) for (let [delay, gain] of [[10, 0.5], [0.0625, -0.9], [100, 0.99]]) {
		let M = Math.round(delay * fs / 1000), want = equation(type, M, Math.fround(gain))
		let got = host(comb, Float64Array.from(x), fs, () => ({ delay, gain, type }), i => 1 + (i * 37) % 500)
		ok(got.every((v, i) => Object.is(v, want[i])), `${type} ${delay} ms (${M} frames), gain ${gain}: the comb's equation, bit for bit, any calls`)
	}
	// 10.01 ms at 48 kHz is 480.48 frames: an impulse's echo lands on frames 480 and 481 as 1 − f and f
	let h = new Float64Array(1000)
	h[0] = 1
	host(comb, h, fs, () => ({ delay: 10.01, gain: 1, type: 'feedforward' }))
	let d = Math.fround(10.01) * fs / 1000, D = Math.floor(d), f = d - D
	ok(Math.abs(h[D] - (1 - f)) < 1e-6 && Math.abs(h[D + 1] - f) < 1e-6 && h.every((v, i) => i === 0 || i === D || i === D + 1 || v === 0), `10.01 ms: echo split ${h[D].toFixed(4)}, ${h[D + 1].toFixed(4)} over frames ${D}, ${D + 1}`)
	// the read, through combBlock on a ramp x[n] = n at gain 1 (two frames of a ramp read between them give the ramp
	// there): y[n] − n is the frame read, n − d. A move from 1 to 100 ms in one call grows the delay by at most half a
	// frame a frame; back from 100 to 1 ms, it shrinks by at most a frame a frame; each ends on the delay asked
	for (let [from, to] of [[48, 4800], [4800, 48]]) {
		let ring = new Float64Array(4802), st = Float64Array.of(0, NaN, NaN), set = Float64Array.of(from, 1, 0), n = 20000, y = Float64Array.from({ length: n }, (_, i) => i)
		combBlock(y.subarray(0, 6000), ring, st, set)
		set[0] = to
		combBlock(y.subarray(6000, 6128), ring, st, set)
		combBlock(y.subarray(6128), ring, st, set)
		let delayAt = i => i - (y[i] - i), most = -Infinity, least = Infinity
		for (let i = 6001; i < n; i++) { let v = delayAt(i) - delayAt(i - 1); most = Math.max(most, v); least = Math.min(least, v) }
		ok(most <= 0.5 && least >= -1 && delayAt(n - 1) === to, `${from} → ${to} frames: the delay moves ${least.toFixed(3)} to ${most.toFixed(3)} a frame, ends at ${delayAt(n - 1)}`)
	}
	// through the manifest, 10 → 12 ms (480 → 576 frames) in one call: before it the equation at 10 ms; once the read is
	// there, 192 frames on at half a frame a frame, the equation at 12 ms, bit for bit
	let at = 9011, y = host(comb, Float64Array.from(x), fs, i => i === 0 ? { delay: 10, gain: 0.7 } : { delay: 12, gain: 0.7 }, i => i === 0 ? at : 1 + (i * 53) % 300)
	let w10 = equation('feedforward', 480, Math.fround(0.7)), w12 = equation('feedforward', 576, Math.fround(0.7))
	ok(y.every((v, i) => i < at ? Object.is(v, w10[i]) : i < at + 192 || Object.is(v, w12[i])), 'delay 10 → 12 ms: the old equation before, the new one from 192 frames on')
})

test('audio.js – process() allocates nothing, warm, its values moving every call and its enums every 16; nor a second instance made after the first ran', { timeout: 120000 }, async () => {
	let file = name => fileURLToPath(new URL(`../packages/${name}/audio.js`, import.meta.url))
	for (let [pkg, names] of [['filter-biquad', ['lowpass', 'highpass', 'bandpass']], ['filter-variable', ['variable']], ['filter-dcblocker', ['dcblocker']],
		['filter-derivative', ['derivative', 'integral']], ['filter-preemphasis', ['emphasis', 'deemphasis']], ['filter-moog-ladder', ['moog']],
		['filter-diode-ladder', ['diode']], ['filter-korg35', ['korg35']], ['filter-oberheim', ['oberheim']], ['filter-comb', ['comb']],
		['filter-resonator', ['resonator']], ['filter-spectral-tilt', ['spectralTilt']]])
		for (let name of names) for (let how of ['moving', 'second']) is(await collections(file(pkg), name, how), 0, `${name}, ${how}: no collection in 2^17 blocks of 8 frames`)
})
