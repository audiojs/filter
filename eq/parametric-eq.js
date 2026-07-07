/**
 * N-band parametric EQ.
 *
 * @module  audio-filter/eq/parametric-eq
 */

import { peaking, lowshelf, highshelf } from 'digital-filter/iir/biquad.js'
import filter from 'digital-filter/core/filter.js'

/**
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { bands: [{fc, Q, gain, type}], fs }
 *   type: 'peak' (default, Q default 1), 'lowshelf'/'highshelf' (Q default 0.707)
 */
export default function parametricEq (data, params) {
	let fs = params.fs || 44100
	let bands = params.bands || []

	// content key: rebuild filters whenever any band's fc/Q/gain/type or fs changes
	let key = fs + '|' + bands.map(b => b.fc + ',' + b.Q + ',' + b.gain + ',' + b.type).join(';')
	if (params._key !== key) {
		params._filters = bands.map(b => {
			let fn = b.type === 'lowshelf' ? lowshelf : b.type === 'highshelf' ? highshelf : peaking
			let Q = b.Q == null ? (fn === peaking ? 1 : 0.707) : b.Q
			return { coefs: fn(b.fc, Q, fs, b.gain || 0) }
		})
		params._key = key
	}

	for (let f of params._filters) filter(data, f)

	return data
}
