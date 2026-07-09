/**
 * Highpass filter — removes everything below cutoff frequency.
 * Order 2 (default): RBJ biquad. Order 4+: Butterworth cascaded SOS.
 *
 * @module  audio-filter/effect/highpass
 */

import { highpass as biquadHp, filter } from '@audio/biquad'

let butterworth

/**
 * @param {Float32Array|Float64Array} data - Input (modified in-place)
 * @param {object} params - { fc, order?, Q?, fs? }
 */
export default function highpass (data, params) {
	let fc = params.fc, fs = params.fs || 44100
	if (fc == null) throw new Error('highpass: params.fc is required')
	let order = params.order || 2, Q = params.Q == null ? 0.707 : params.Q

	if (!params.coefs || params._fc !== fc || params._order !== order || params._Q !== Q || params._fs !== fs) {
		if (order <= 2) params.coefs = [biquadHp(fc, Q, fs)]
		else {
			if (!butterworth) throw new Error('Import digital-filter/iir/butterworth.js for order > 2')
			params.coefs = butterworth(order, fc, fs, 'highpass')
		}
		params._fc = fc; params._order = order; params._Q = Q; params._fs = fs
	}

	return filter(data, params)
}

highpass.useButterworth = (bw) => { butterworth = bw }
