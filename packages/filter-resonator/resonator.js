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

export default function resonator (data, params) {
	let fc = params.fc, fs = params.fs || 44100
	if (fc == null) throw new Error('resonator: params.fc is required')
	let bw = params.bw || 50

	// Recompute coefficients if params changed (keys prefixed _r* — params may be a
	// caller-owned object, eg speech/formant.js's per-band state, so must not collide
	// with its own fields such as `gain`)
	if (params._rFc !== fc || params._rBw !== bw || params._rFs !== fs) {
		let R = exp(-PI * bw / fs)
		let w0 = 2 * PI * fc / fs
		params._rA1 = -2 * R * cos(w0)
		params._rA2 = R * R
		params._rB0 = (1 - R * R) / 2
		params._rB2 = -params._rB0
		params._rFc = fc
		params._rBw = bw
		params._rFs = fs
	}

	let a1 = params._rA1, a2 = params._rA2, b0 = params._rB0, b2 = params._rB2
	let x1 = params._rX1 != null ? params._rX1 : 0
	let x2 = params._rX2 != null ? params._rX2 : 0
	let y1 = params._rY1 != null ? params._rY1 : 0
	let y2 = params._rY2 != null ? params._rY2 : 0

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2
		x2 = x1
		x1 = x
		y2 = y1
		y1 = y
		data[i] = y
	}

	params._rX1 = x1
	params._rX2 = x2
	params._rY1 = y1
	params._rY2 = y2

	return data
}
