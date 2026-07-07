/**
 * Linear Predictive Coding analysis/synthesis.
 * Autocorrelation method with Levinson-Durbin recursion.
 *
 * @module  audio-filter/speech/lpc
 */

/**
 * LPC analysis via autocorrelation + Levinson-Durbin.
 * @param {Float64Array} data - Input signal
 * @param {object} params - { order (12) }
 * @returns {{ coefs: Float64Array, gain: number, residual: Float64Array }}
 */
export function lpcAnalysis(data, params) {
	let order = params.order || 12
	let N = data.length

	// Autocorrelation r[0..order], normalized per-sample (Rabiner & Schafer biased
	// estimator) so E/gain are frame-length invariant, not sum-length dependent
	let r = new Float64Array(order + 1)
	for (let i = 0; i <= order; i++) {
		for (let n = i; n < N; n++) r[i] += data[n] * data[n - i]
		r[i] /= N
	}

	// Levinson-Durbin
	let a = new Float64Array(order + 1)
	let prev = new Float64Array(order + 1)
	a[0] = 1
	let E = r[0]

	for (let i = 1; i <= order; i++) {
		let sum = 0
		for (let j = 1; j < i; j++) sum += a[j] * r[i - j]
		let k = -(r[i] + sum) / E

		// Copy current coefficients
		prev.set(a)

		for (let j = 1; j < i; j++) a[j] = prev[j] + k * prev[i - j]
		a[i] = k

		E *= (1 - k * k)
	}

	let gain = Math.sqrt(E) // per-sample prediction-error std (E is already per-sample)
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
