/**
 * Linear Predictive Coding analysis/synthesis.
 * Autocorrelation method with Levinson-Durbin recursion (the AR-fit math is
 * @audio/lpc's autocorr+levinson — this atom keeps its own gain/residual convention).
 *
 * @module  audio-filter/speech/lpc
 */

import { autocorr, levinson } from '@audio/lpc'

/**
 * LPC analysis via autocorrelation + Levinson-Durbin.
 * @param {Float64Array} data - Input signal
 * @param {object} params - { order (12) }
 * @returns {{ coefs: Float64Array, gain: number, residual: Float64Array }}
 */
export function lpcAnalysis(data, params) {
	let order = params.order || 12
	let N = data.length

	// @audio/lpc's autocorr is unnormalized (Σ, not Σ/N); reflection coefficients and
	// a[] are scale-invariant under that (a constant factor on R cancels in the k_i
	// ratio), so coefs come out identical to the old locally-normalized r[i]/=N version —
	// only the residual energy e scales by N, corrected below (Rabiner & Schafer biased
	// estimator ⇒ per-sample E/gain, frame-length invariant).
	let { a, e } = levinson(autocorr(data, order), order)

	let gain = Math.sqrt(e / N) // per-sample prediction-error std
	let coefs = a.subarray(1) // a[1..order] of A(z) = 1 + Σ a_k z⁻ᵏ

	// Whitening filter e[n] = A(z)x[n] = x[n] + Σ coefs[k]·x[n−1−k], normalized to unit power
	let residual = new Float64Array(N)
	for (let n = 0; n < N; n++) {
		let sum = 0
		for (let k = 1; k <= order; k++) if (n - k >= 0) sum += coefs[k - 1] * data[n - k]
		residual[n] = (data[n] + sum) / gain
	}

	return { coefs: new Float64Array(coefs), gain, residual }
}

/**
 * All-pole synthesis filter.
 * @param {Float64Array} excitation - Excitation/residual signal, unit power (modified in-place)
 * @param {object} params - { coefs, gain (1), _s (internal state) }
 * @returns {Float64Array} Synthesized signal
 */
export function lpcSynthesize(excitation, params) {
	let coefs = params.coefs
	let gain = params.gain != null ? params.gain : 1
	let order = coefs.length
	let N = excitation.length

	if (!params._s || params._s.length !== order) params._s = new Float64Array(order)
	let s = params._s

	// y[n] = gain·u[n] - Σ coefs[k]·y[n-1-k] — algebraic inverse of lpcAnalysis's
	// e[n] = x[n] + Σ coefs[k]·x[n-1-k], u = e/gain
	for (let n = 0; n < N; n++) {
		let y = gain * excitation[n]
		for (let k = 0; k < order; k++) y -= coefs[k] * s[k]
		excitation[n] = y

		// Shift state
		for (let k = order - 1; k > 0; k--) s[k] = s[k - 1]
		s[0] = y
	}

	return excitation
}
