/**
 * Constant-peak-gain resonator (JOS two-zero form)
 * Two zeros at z=±1 normalize the pole peak to exactly 1, regardless of fc/bw.
 * Used for modal synthesis (bells, drums), formant synthesis.
 *
 * H(z) = ((1-R²)/2)·(1-z⁻²) / (1 - 2R*cos(w0)*z^-1 + R²*z^-2)
 * where R = exp(-π*bw/fs), w0 = 2π*fc/fs
 *
 * cf. Julius O. Smith III, "Introduction to Digital Filters", Two-Pole
 * section, "Constant Peak-Gain Resonator"
 *
 * @module  audio-filter/effect/resonator
 */

let {cos, exp, PI} = Math

const C = new Float64Array(4), S = new Float64Array(4)   // a direct call's coefficients and x1, x2, y1, y2

export default function resonator (data, params) {
	let fc = params.fc, fs = params.fs || 44100
	if (fc == null) throw new Error('resonator: params.fc is required')
	let bw = params.bw || 50

	// Recompute coefficients if params changed (keys prefixed _r* — params may be a
	// caller-owned object, eg speech/formant.js's per-band state, so must not collide
	// with its own fields such as `gain`)
	if (params._rFc !== fc || params._rBw !== bw || params._rFs !== fs) {
		resonatorCoefs(fc, bw, fs, C)
		params._rA1 = C[2]
		params._rA2 = C[3]
		params._rB0 = C[0]
		params._rB2 = C[1]
		params._rFc = fc
		params._rBw = bw
		params._rFs = fs
	}

	C[0] = params._rB0; C[1] = params._rB2; C[2] = params._rA1; C[3] = params._rA2
	S[0] = params._rX1 != null ? params._rX1 : 0
	S[1] = params._rX2 != null ? params._rX2 : 0
	S[2] = params._rY1 != null ? params._rY1 : 0
	S[3] = params._rY2 != null ? params._rY2 : 0

	resonatorBlock(data, S, C)

	params._rX1 = S[0]
	params._rX2 = S[1]
	params._rY1 = S[2]
	params._rY2 = S[3]

	return data
}

/** The section of a resonator at fc, bw and fs, written into `c` (a Float64Array of b0, b2, a1, a2) and returned */
export function resonatorCoefs (fc, bw, fs, c = new Float64Array(4)) {
	let R = exp(-PI * bw / fs)
	let w0 = 2 * PI * fc / fs
	c[2] = -2 * R * cos(w0)
	c[3] = R * R
	c[0] = (1 - R * R) / 2
	c[1] = -c[0]
	return c
}

/**
 * One block in place, allocating nothing: `s` a Float64Array of x1, x2, y1, y2 (kept from call to call), `c` one of
 * b0, b2, a1, a2 (resonatorCoefs)
 */
export function resonatorBlock (data, s, c) {
	let b0 = c[0], b2 = c[1], a1 = c[2], a2 = c[3]
	let x1 = s[0], x2 = s[1], y1 = s[2], y2 = s[3]

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2
		x2 = x1
		x1 = x
		y2 = y1
		y1 = y
		data[i] = y
	}

	s[0] = x1; s[1] = x2; s[2] = y1; s[3] = y2

	return data
}
