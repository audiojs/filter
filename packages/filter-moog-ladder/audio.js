// atom manifest — Moog 4-pole ZDF ladder (lowpass, highpass, bandpass; 2 or 4 poles; self-oscillates at resonance 1) per @audio/compile CONTRACT.
// Each channel's state is a Float64Array made here and the live values go through one more, so a block allocates
// nothing; every param is live. `poles` between its steps takes the nearer one. A new type or pole count moves the
// output from the old taps to the new over FADE seconds (moogFade), as a tap switched in one sample would click. fc
// retunes the ladder: a host ramps it (smoothing 0.02), the kernel taking each call's value.
import { moogBlock, moogFade } from './moog-ladder.js'

const FADE = 0.02

export const moog = (ctx) => {
	const st = [], fades = [], set = new Float64Array(4), was = Int32Array.of(-1, 0)   // set: fc, resonance, drive, fs; was: the type and poles in force
	for (let c = 0; c < ctx.maxChannels; c++) {
		st.push(new Float64Array(4))
		fades.push(Float64Array.of(1, 1 / (FADE * ctx.sampleRate), 0, 0, 0, 0, 0))   // where a fade is, its step, the taps it began from
	}
	set[3] = ctx.sampleRate
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0], poles = params.poles[0] < 3 ? 2 : 4, type = params.type, k = TYPES.indexOf(type)
		if (k !== was[0] || poles !== was[1]) {
			if (was[0] >= 0) for (let c = 0; c < fades.length; c++) moogFade(fades[c], TYPES[was[0]], was[1])
			was[0] = k
			was[1] = poles
		}
		set[0] = params.fc[0]
		set[1] = params.resonance[0]
		set[2] = params.drive[0]
		for (let c = 0; c < inp.length; c++) {
			out[c].set(inp[c])
			moogBlock(out[c], st[c], set, type, poles, fades[c])
		}
	}
}
moog.channels = 'any'
moog.params = {
	fc:        { type: 'number', min: 20, max: 20000, default: 1000, unit: 'Hz', curve: 'log', smoothing: 0.02 },
	resonance: { type: 'number', min: 0, max: 1, default: 0 },
	drive:     { type: 'number', min: 0.1, max: 10, default: 1 },
	type:      { type: 'enum', values: ['lowpass', 'highpass', 'bandpass'], default: 'lowpass' },
	poles:     { type: 'number', min: 2, max: 4, default: 4, step: 2 },
}
const TYPES = moog.params.type.values

moog.tail = ({ sampleRate, params }) => {
	let set = Float64Array.of(params.fc[0], params.resonance[0], params.drive[0], sampleRate), type = params.type, poles = params.poles[0] < 3 ? 2 : 4
	return tail((x, s) => moogBlock(x, s, set, type, poles), 4, sampleRate)
}

// The tail at the values in force, by @audio/biquad's rule (its tail(): the frames until the rest of the impulse
// response, Σ|h| from there on, is under 1e-3; 0 at 128 frames or under), h that of the ladder at rest. A, B, C and D
// are read off `step` (one sample through the block function in place: x a Float64Array(1), s the n states) on states
// of 1e-100, where tanh x is x, the drive a gain on the way. The rest past what is summed is bounded from the state by
// the poles, the roots of det(z − A) (Faddeev–LeVerrier; Durand–Kerner for four) taken in conjugate or real pairs, each
// pair's ring bounded as @audio/biquad's rest2 bounds it; past 2^14 frames by that bound alone, A raised by squaring.
// Infinity where a pole reaches the unit circle (the ladder self-oscillates). Driven hard the ladder is not this linear
// system: there the bound is measured, not proven (no ring at input levels 0.03 to 10 outlasted it). The same lines are
// in the four ladders, none of which depends on another
function tail (step, n, fs) {
	let E = 1e-100, x = new Float64Array(1), s = new Float64Array(n), A = new Float64Array(n * n), B = new Float64Array(n), C = new Float64Array(n)
	for (let j = 0; j <= n; j++) {
		s.fill(0)
		if (j < n) s[j] = E
		x[0] = j < n ? 0 : E
		step(x, s)
		if (j < n) { C[j] = x[0] / E; for (let i = 0; i < n; i++) A[i * n + j] = s[i] / E }
	}
	let D = x[0] / E
	B.set(s); for (let i = 0; i < n; i++) B[i] /= E
	// the pairs of poles, the slower first: q[0], q[1] its z² + a1·z + a2, q[2], q[3] the other's
	let q = poles(A, n), r = Math.max(q[4], q[5])
	if (!(r < 1)) return Infinity
	let v = new Float64Array(n), w = new Float64Array(n), y = new Float64Array(4), z = new Float64Array(n)
	let mul = (M, a, b) => { for (let i = 0; i < n; i++) { let t = 0; for (let j = 0; j < n; j++) t += M[i * n + j] * a[j]; z[i] = t } b.set(z) }
	// a bound on the rest of h from the state u: its next n outputs exactly, the ring past them by the pairs'. For four
	// poles y is the slower pair's ring driven by the faster's: y_{j+2} + a1·y_{j+1} + a2·y_j = g_j, g the faster ring
	let u = new Float64Array(n), rest = st => {
		u.set(st)
		for (let j = 0; j < n; j++) { let t = 0; for (let i = 0; i < n; i++) t += C[i] * u[i]; y[j] = t; mul(A, u, u) }
		if (n === 2) return rest2(q[0], q[1], y[0], y[1])
		let L = 1 + rest2(q[0], q[1], -q[0], q[0] * q[0] - q[1])
		return rest2(q[0], q[1], y[0], y[1]) + L * rest2(q[2], q[3], y[2] + q[0] * y[1] + q[1] * y[0], y[3] + q[0] * y[2] + q[1] * y[1])
	}
	// frames k to k + m of h; the sum of their |h|
	let run = (k, m) => {
		let sum = 0
		for (let end = k + m; k < end; k++) {
			if (k === 0) { sum += Math.abs(D); v.set(B); continue }
			let t = 0
			for (let i = 0; i < n; i++) t += C[i] * v[i]
			sum += Math.abs(t)
			for (let i = 0; i < n; i++) { let a = 0; for (let j = 0; j < n; j++) a += A[i * n + j] * v[j]; w[i] = a }
			let o = v; v = w; w = o
		}
		return sum
	}
	let total = 0, k = 0, R
	do { total += run(k, 256); k += 256; R = rest(v) } while (!(R <= 1e-4) && k < 1 << 14)
	let N
	if (R <= 1e-3) {
		// the first frame from which the sum past it and the bound on the rest are under 1e-3
		v.fill(0)
		let left = total + R, keep = new Float64Array(n)
		for (N = 0; ; N += 256) { keep.set(v); let m = run(N, 256); if (left - m <= 1e-3) { v.set(keep); break } left -= m }
		while (left > 1e-3) left -= run(N++, 1)
	} else {
		// a ring longer than 2^14 frames: on from there by powers of A, A^(2^i) squared from A, to where the bound on the
		// rest is under 1e-3 (the rest only falls, so from there on it stays under)
		let P = [Float64Array.from(A)], T = new Float64Array(n * n)
		for (let i = 1; i < 48; i++) {
			let M = P[i - 1]
			for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) { let t = 0; for (let c = 0; c < n; c++) t += M[a * n + c] * M[c * n + b]; T[a * n + b] = t }
			P.push(Float64Array.from(T))
		}
		let J = 0, at = Float64Array.from(v), next = new Float64Array(n)
		for (let i = 47; i >= 0; i--) {
			next.set(at); mul(P[i], next, next)
			if (rest(next) > 1e-3) { at.set(next); J += 2 ** i }
		}
		while (rest(at) > 1e-3 && J < 2 ** 48) { mul(A, at, at); J++ }
		N = k + J
		if (!(N < 2 ** 47)) return Infinity
	}
	return N - 1 <= 128 ? 0 : (N - 1) / fs
}

// The poles of A, in two real pairs z² + a1·z + a2: [a1, a2 of the slower pair, a1, a2 of the other, the radius of
// each]. Two states: the trace and determinant. Four: det(z − A) by Faddeev–LeVerrier, its roots by Durand–Kerner,
// paired by their imaginary parts (a conjugate pair, or two real roots)
function poles (A, n) {
	if (n === 2) {
		let a1 = -(A[0] + A[3]), a2 = A[0] * A[3] - A[1] * A[2], d = a1 * a1 - 4 * a2
		return Float64Array.of(a1, a2, 0, 0, d < 0 ? Math.sqrt(a2) : (Math.abs(a1) + Math.sqrt(d)) / 2, 0)
	}
	let c = new Float64Array(5), M = new Float64Array(16), T = new Float64Array(16)
	c[0] = 1
	for (let k = 1; k <= 4; k++) {
		for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
			let t = i === j ? c[k - 1] : 0
			for (let l = 0; l < 4; l++) t += A[i * 4 + l] * M[l * 4 + j]
			T[i * 4 + j] = t
		}
		M.set(T)
		let tr = 0
		for (let i = 0; i < 4; i++) for (let l = 0; l < 4; l++) tr += A[i * 4 + l] * M[l * 4 + i]
		c[k] = -tr / k
	}
	let re = Float64Array.of(0.4, -0.3, 0.2, -0.5), im = Float64Array.of(0.9, 0.6, -0.7, -0.4)
	for (let it = 0; it < 500; it++) for (let i = 0; i < 4; i++) {
		let pr = 1, pi = 0, qr = 1, qi = 0
		for (let k = 1; k <= 4; k++) { let t = pr * re[i] - pi * im[i]; pi = pr * im[i] + pi * re[i]; pr = t + c[k] }
		for (let j = 0; j < 4; j++) if (j !== i) { let dr = re[i] - re[j], di = im[i] - im[j], t = qr * dr - qi * di; qi = qr * di + qi * dr; qr = t }
		let d = qr * qr + qi * qi
		re[i] -= (pr * qr + pi * qi) / d
		im[i] -= (pi * qr - pr * qi) / d
	}
	let o = [0, 1, 2, 3].sort((a, b) => im[b] - im[a]), pair = (a, b) => [-(re[a] + re[b]), re[a] * re[b] - im[a] * im[b], Math.max(Math.hypot(re[a], im[a]), Math.hypot(re[b], im[b]))]
	let p = pair(o[0], o[3]), g = pair(o[1], o[2])
	if (g[2] > p[2]) [p, g] = [g, p]
	return Float64Array.of(p[0], p[1], g[0], g[1], p[2], g[2])
}

// A bound on Σ|y_j|, j ≥ 0, for y_j = −a1·y_{j−1} − a2·y_{j−2}: @audio/biquad's rest2 (there, why each bound holds)
function rest2 (a1, a2, y0, y1) {
	if (y0 === 0 && y1 === 0) return 0
	let d = a1 * a1 - 4 * a2, s = Math.sqrt(Math.abs(d)), Y0 = Math.abs(y0)
	if (d < 0) {
		let r = Math.sqrt(a2)
		if (!(r < 1)) return Infinity
		return Math.min(Math.sqrt(4 * (y1 * y1 + a1 * y0 * y1 + a2 * y0 * y0) / -d) / (1 - r), Y0 / (1 - r) + Math.hypot(y1 + a1 / 2 * y0, s / 2 * y0) / (1 - r) ** 2)
	}
	let p = (s - a1) / 2, q = (-s - a1) / 2, r = Math.max(Math.abs(p), Math.abs(q))
	if (!(r < 1)) return Infinity
	let u = Y0 / (1 - r) + Math.min(Math.abs(y1 - p * y0), Math.abs(y1 - q * y0)) / (1 - r) ** 2
	return s > 0 ? Math.min(u, Math.abs(y1 - q * y0) / s / (1 - Math.abs(p)) + Math.abs(y1 - p * y0) / s / (1 - Math.abs(q))) : u
}

