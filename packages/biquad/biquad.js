// Shared biquad kernel — RBJ Audio-EQ-Cookbook coefficients (normalized a0 = 1) +
// transposed direct-form-II processing with persistent per-channel state. The one
// coefficient/kernel source for @audio family cores (dedupe target).

const PI2 = Math.PI * 2

function base (fc, Q, fs) {
	let w = PI2 * fc / fs
	return { cw: Math.cos(w), sw: Math.sin(w), alpha: Math.sin(w) / (2 * Q) }
}
const norm = (b0, b1, b2, a0, a1, a2) => ({ b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 })

export function lowpass (fc, Q = Math.SQRT1_2, fs = 44100) {
	let { cw, alpha } = base(fc, Q, fs)
	return norm((1 - cw) / 2, 1 - cw, (1 - cw) / 2, 1 + alpha, -2 * cw, 1 - alpha)
}
export function highpass (fc, Q = Math.SQRT1_2, fs = 44100) {
	let { cw, alpha } = base(fc, Q, fs)
	return norm((1 + cw) / 2, -(1 + cw), (1 + cw) / 2, 1 + alpha, -2 * cw, 1 - alpha)
}
export function bandpass (fc, Q = 1, fs = 44100) {  // constant 0 dB peak gain
	let { cw, alpha } = base(fc, Q, fs)
	return norm(alpha, 0, -alpha, 1 + alpha, -2 * cw, 1 - alpha)
}
export function notch (fc, Q = 1, fs = 44100) {
	let { cw, alpha } = base(fc, Q, fs)
	return norm(1, -2 * cw, 1, 1 + alpha, -2 * cw, 1 - alpha)
}
export function allpass (fc, Q = Math.SQRT1_2, fs = 44100) {
	let { cw, alpha } = base(fc, Q, fs)
	return norm(1 - alpha, -2 * cw, 1 + alpha, 1 + alpha, -2 * cw, 1 - alpha)
}
export function peaking (fc, Q = 1, fs = 44100, dB = 0) {
	let { cw, alpha } = base(fc, Q, fs)
	let A = 10 ** (dB / 40)
	return norm(1 + alpha * A, -2 * cw, 1 - alpha * A, 1 + alpha / A, -2 * cw, 1 - alpha / A)
}
export function lowshelf (fc, Q = Math.SQRT1_2, fs = 44100, dB = 0) {
	let { cw, sw } = base(fc, Q, fs)
	let A = 10 ** (dB / 40), s = Math.sqrt(A) * sw / Q
	return norm(
		A * ((A + 1) - (A - 1) * cw + s), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - s),
		(A + 1) + (A - 1) * cw + s, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - s)
}
export function highshelf (fc, Q = Math.SQRT1_2, fs = 44100, dB = 0) {
	let { cw, sw } = base(fc, Q, fs)
	let A = 10 ** (dB / 40), s = Math.sqrt(A) * sw / Q
	return norm(
		A * ((A + 1) + (A - 1) * cw + s), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - s),
		(A + 1) - (A - 1) * cw + s, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - s)
}

/** Fresh section state (transposed DF-II: two accumulators). */
export const state = () => new Float64Array(2)

/** Process in place through one section; state persists across chunks. */
export function process (data, c, s = state()) {
	let z1 = s[0], z2 = s[1]
	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let y = c.b0 * x + z1
		z1 = c.b1 * x - c.a1 * y + z2
		z2 = c.b2 * x - c.a2 * y
		data[i] = y
	}
	s[0] = z1; s[1] = z2
	return data
}

/** One sample through one section — sidechain/per-sample use. */
export function step (c, s, x) {
	let y = c.b0 * x + s[0]
	s[0] = c.b1 * x - c.a1 * y + s[1]
	s[1] = c.b2 * x - c.a2 * y
	return y
}

/** Cascade of sections. states: array of state() per section (created if absent). */
export function cascade (data, coefs, states) {
	states ??= coefs.map(() => state())
	for (let i = 0; i < coefs.length; i++) process(data, coefs[i], states[i])
	return data
}

/**
 * Params-convention kernel: coefs (section or array) + state persisted on params —
 * the ecosystem's streaming convention (drop-in for digital-filter/core/filter.js).
 */
export function filter (data, params) {
	let coefs = Array.isArray(params.coefs) ? params.coefs : [params.coefs]
	if (coefs[0] == null || coefs[0].b0 == null) throw Error('filter: params.coefs must be SOS section(s) {b0,b1,b2,a1,a2}')
	params.state ??= coefs.map(() => state())
	return cascade(data, coefs, params.state)
}

/** |H(f)| at frequency f — analysis/plotting support. */
export function magnitude (c, f, fs = 44100) {
	let w = PI2 * f / fs
	let cos1 = Math.cos(w), cos2 = Math.cos(2 * w), sin1 = Math.sin(w), sin2 = Math.sin(2 * w)
	let nr = c.b0 + c.b1 * cos1 + c.b2 * cos2, ni = -(c.b1 * sin1 + c.b2 * sin2)
	let dr = 1 + c.a1 * cos1 + c.a2 * cos2, di = -(c.a1 * sin1 + c.a2 * sin2)
	return Math.hypot(nr, ni) / Math.hypot(dr, di)
}

/** |H(f)| of a cascade (array of SOS sections) — product of each section's magnitude. */
export function cascadeMagnitude (sos, f, fs = 44100) {
	let mag = 1
	for (let c of sos) mag *= magnitude(c, f, fs)
	return mag
}
