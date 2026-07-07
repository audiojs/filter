/**
 * Headphone crossfeed filter.
 * Mixes L->R and R->L through a frequency-dependent filter to improve imaging.
 *
 * @module  audio-filter/eq/crossfeed
 */

import { lowpass } from 'digital-filter/iir/biquad.js'
import filter from 'digital-filter/core/filter.js'

/**
 * @param {Float64Array} left - Left channel (modified in-place)
 * @param {Float64Array} right - Right channel (modified in-place)
 * @param {object} params - { fc: crossfeed cutoff (700), level: mix amount 0-1 (0.3), fs }
 */
export default function crossfeed (left, right, params) {
	let fc = params.fc || 700
	let level = params.level != null ? params.level : 0.3
	let fs = params.fs || 44100

	if (!params._coefs || params._fc !== fc || params._fs !== fs || params._level !== level) {
		params._coefs = lowpass(fc, 0.5, fs)
		params._stateL = { coefs: params._coefs }
		params._stateR = { coefs: params._coefs }
		params._fc = fc; params._fs = fs; params._level = level
	}

	// Filter copies for crossfeed
	let crossL = Float64Array.from(right)
	let crossR = Float64Array.from(left)

	filter(crossL, params._stateL)
	filter(crossR, params._stateR)

	// direct + cross = 1: mono/correlated content stays at unity gain (Bauer/BS2B)
	for (let i = 0; i < left.length; i++) {
		left[i] = left[i] * (1 - level * 0.5) + crossL[i] * (level * 0.5)
		right[i] = right[i] * (1 - level * 0.5) + crossR[i] * (level * 0.5)
	}

	return { left, right }
}
