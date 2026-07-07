/**
 * IEC 61260 fractional-octave filter bank.
 * Generates bandpass filters at standard ISO center frequencies.
 */

import { bandpass2 } from 'digital-filter/iir/biquad.js'

let { pow, log, ceil, floor, round } = Math

/**
 * Generate IEC 61260 fractional-octave filter bank.
 * @param {number} fraction - Octave fraction, e.g. 1 (full octave) or 3 (1/3-octave, default)
 * @param {number} fs - Sample rate (default 44100)
 * @param {object} opts - { fmin: 31.25, fmax: 16000 }
 * @returns {Array<{fc: number, coefs: {b0,b1,b2,a1,a2}}>}
 */
export default function octaveBank (fraction, fs, opts) {
	if (!fraction) fraction = 3
	if (!fs) fs = 44100
	if (!opts) opts = {}
	let fmin = opts.fmin || 31.25
	let fmax = opts.fmax || 16000

	// ISO 266 octave ratio: G = 10^(3/10)
	let G = pow(10, 3 / 10)
	let logG = log(G)

	// Center frequencies: fc = 1000 * G^(k/fraction)
	let kMin = ceil(fraction * log(fmin / 1000) / logG)
	let kMax = floor(fraction * log(fmax / 1000) / logG)

	let bands = []
	let bw = pow(G, 1 / (2 * fraction)) - pow(G, -1 / (2 * fraction))
	let Q = 1 / bw

	for (let k = kMin; k <= kMax; k++) {
		let fc = 1000 * pow(G, k / fraction)
		if (fc < 20 || fc > fs / 2) continue

		bands.push({
			fc: round(fc * 10) / 10,
			coefs: bandpass2(fc, Q, fs)
		})
	}

	return bands
}
