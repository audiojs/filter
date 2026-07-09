/**
 * Variable-bandwidth filter with per-sample smoothed coefficient trajectory.
 * fc/Q are exponentially smoothed toward their target values (~5ms time
 * constant) and coefficients recomputed every sample from the smoothed
 * values — so a mid-stream parameter change doesn't produce the coefficient
 * jump (click) that plain lowpass.js/highpass.js would. This smoothing is
 * the filter's reason to exist vs those.
 *
 * @module  audio-filter/effect/variable-bandwidth
 */

import { lowpass, highpass, bandpass } from '@audio/biquad'

let TAU = 0.005 // parameter smoothing time constant, seconds

/**
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { fc, Q, fs, type: 'lowpass'|'highpass'|'bandpass' }
 */
export default function variableBandwidth (data, params) {
	let fc = params.fc || 1000
	let Q = params.Q || 0.707
	let fs = params.fs || 44100
	let type = params.type || 'lowpass'

	let fn = type === 'highpass' ? highpass : type === 'bandpass' ? bandpass : lowpass

	if (params._fcCur == null) { params._fcCur = fc; params._qCur = Q }
	if (!params._state) params._state = [0, 0]

	let smooth = Math.exp(-1 / (TAU * fs))
	let s = params._state

	for (let i = 0, n = data.length; i < n; i++) {
		params._fcCur += (fc - params._fcCur) * (1 - smooth)
		params._qCur += (Q - params._qCur) * (1 - smooth)
		let c = fn(params._fcCur, params._qCur, fs)
		let x = data[i]
		let y = c.b0 * x + s[0]
		s[0] = c.b1 * x - c.a1 * y + s[1]
		s[1] = c.b2 * x - c.a2 * y
		data[i] = y
	}

	return data
}
