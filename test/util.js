export let EPSILON = 1e-10
export let LOOSE = 1e-4

// Compute DFT magnitude at a specific frequency
export function dftMag(data, f, fs) {
	let w = 2 * Math.PI * f / fs
	let re = 0, im = 0
	for (let n = 0; n < data.length; n++) {
		re += data[n] * Math.cos(w * n)
		im -= data[n] * Math.sin(w * n)
	}
	return Math.sqrt(re * re + im * im)
}

// Evaluate SOS filter magnitude in dB at exact frequency f Hz
export function magDB(sos, f, fs) {
	let w = 2 * Math.PI * f / fs
	let magSq = 1
	for (let c of sos) {
		let br = c.b0 + c.b1 * Math.cos(w)   + c.b2 * Math.cos(2*w)
		let bi =      -(c.b1 * Math.sin(w)   + c.b2 * Math.sin(2*w))
		let ar = 1   + c.a1 * Math.cos(w)   + c.a2 * Math.cos(2*w)
		let ai =      -(c.a1 * Math.sin(w)   + c.a2 * Math.sin(2*w))
		magSq *= (br*br + bi*bi) / (ar*ar + ai*ai)
	}
	return 10 * Math.log10(magSq)
}

export function impulse (n) {
	let d = new Float64Array(n || 64)
	d[0] = 1
	return d
}

export function dc (n, val) {
	let d = new Float64Array(n || 64)
	d.fill(val || 1)
	return d
}

// The rings a filter leaves once its input stops, each in frames after the input's last frame until the output stays
// 60 dB under the input's level, as @audio/compile's validator measures a tail: after an impulse of `amp`, after a long
// DC step of `amp`, after a long tone of amplitude `amp` at each of `freqs`, and after the validator's noise burst
// (Gaussian, σ 0.15·amp, its level its RMS) by its RMS over windows of 64 frames. `run(x)` filters x (a Float64Array)
// in place with a fresh filter, `latency` frames late; `frames` the declared tail. Each input is held 3 tails and at
// least 4096 frames, its ring followed as long. `short`: a ring outlasts the tail, or 128 frames where the tail is less
// ("A ring shorter than 128 frames needs no tail", CONTRACT.md), the noise windows judged from there as the validator
// judges them. `over`: the tail against the longest ring, where that ring is over 128 frames
export function rings (run, frames, { fs, freqs = [], amp = 1, latency = 0 } = {}) {
	let T = Math.max(128, Math.ceil(frames)), hold = Math.max(4096, Math.ceil(3 * frames)), n = hold + hold + latency
	let last = (y, from) => { let q = 0; for (let i = from + latency; i < y.length; i++) if (Math.abs(y[i]) > 1e-3 * amp) q = i - from - latency + 1; return q }
	let x = new Float64Array(n)
	x[hold - 1] = amp
	run(x)
	let r = { impulse: last(x, hold), dc: 0, tone: 0, toneAt: 0, noise: 0 }
	x = new Float64Array(n).fill(amp, 0, hold)
	run(x)
	r.dc = last(x, hold)
	for (let f of freqs) {
		if (!(f < 0.49 * fs)) continue
		x = new Float64Array(n)
		for (let i = 0; i < hold; i++) x[i] = amp * Math.sin(2 * Math.PI * f * i / fs)
		run(x)
		let q = last(x, hold)
		if (q > r.tone) { r.tone = q; r.toneAt = f }
	}
	let seed = 999, u = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296, e = 0
	x = new Float64Array(n)
	for (let i = 0; i < hold; i++) { x[i] = 0.15 * amp * Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u()); e += x[i] * x[i] }
	run(x)
	let floor = Math.sqrt(e / hold) * 1e-3, loud = i => { let s = 0; for (let j = i; j < i + 64; j++) s += x[j] * x[j]; return !(Math.sqrt(s / 64) <= floor) }, late = false
	for (let i = hold + latency; i + 64 <= n; i += 64) if (loud(i)) r.noise = i + 64 - hold - latency
	for (let i = hold + latency + T; i + 64 <= n; i += 64) late ||= loud(i)
	r.longest = Math.max(r.impulse, r.dc, r.tone, r.noise)
	r.short = Math.max(r.impulse, r.dc, r.tone) > T || late
	r.over = r.longest > 128 ? frames / r.longest : 0
	return r
}

// Collections while a manifest's process() runs warm: 2^17 calls of 8 frames on 2 channels at 48 kHz, every numeric
// param moved each call (as automation moves it; held at its default with how 'fixed'; 'second' counts a second instance,
// made once a first has run), in a child Node with a 1 MB young generation, so that 16 bytes a call
// would show. The engine's own count, as @audio/compile's validator takes it; a block that allocates nothing sees none
export async function collections (file, name, how = 'moving') {
	let { execFile } = await import('node:child_process'), { fileURLToPath } = await import('node:url')
	let child = fileURLToPath(new URL('./collections.js', import.meta.url))
	return new Promise((res, rej) => execFile(process.execPath, ['--max-semi-space-size=1', '--expose-gc', '--no-concurrent-recompilation', child, file, name, how],
		(err, out) => err ? rej(err) : res(+out)))
}
