/**
 * Allpass filter — unity magnitude, frequency-dependent phase shift
 *
 * @module  audio-filter/effect/allpass
 */

import { allpass as biquadAllpass, filter } from '@audio/biquad'

let {sin, cos, PI} = Math

/**
 * First-order allpass: H(z) = (a + z^-1) / (1 + a*z^-1)
 */
export function first (data, params) {
	let a = params.a
	let x1 = params.x1 != null ? params.x1 : 0
	let y1 = params.y1 != null ? params.y1 : 0

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let y = a * x + x1 - a * y1
		x1 = x
		y1 = y
		data[i] = y
	}

	params.x1 = x1
	params.y1 = y1

	return data
}

/**
 * Second-order allpass via biquad (RBJ)
 */
export function second (data, params) {
	let fc = params.fc, Q = params.Q == null ? .707 : params.Q, fs = params.fs || 44100
	if (!params.coefs || params._fc !== fc || params._Q !== Q || params._fs !== fs) {
		params.coefs = [biquadAllpass(fc, Q, fs)]
		params.state = null
		params._fc = fc
		params._Q = Q
		params._fs = fs
	}

	return filter(data, params)
}
