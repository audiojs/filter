/**
 * Pre-emphasis / de-emphasis filter
 * Used in speech processing, FM broadcasting.
 *
 * Pre-emphasis:  H(z) = 1 - α*z^-1  (boosts high frequencies)
 * De-emphasis:   H(z) = 1 / (1 - α*z^-1)  (cuts high frequencies)
 *
 * @module  audio-filter/effect/pre-emphasis
 */

const S = new Float64Array(2)   // a direct call's x1 or y1, and alpha

export function emphasis (data, params) {
	S[1] = params.alpha != null ? params.alpha : 0.97
	S[0] = params.x1 != null ? params.x1 : 0
	emphasisBlock(data, S)
	params.x1 = S[0]
	return data
}

export function deemphasis (data, params) {
	S[1] = params.alpha != null ? params.alpha : 0.97
	S[0] = params.y1 != null ? params.y1 : 0
	deemphasisBlock(data, S)
	params.y1 = S[0]
	return data
}

/**
 * One block in place, allocating nothing: `s` a Float64Array of x1 (kept from call to call) and alpha; `alphas`, when
 * given, alpha each frame in its place
 */
export function emphasisBlock (data, s, alphas) {
	let x1 = s[0], alpha = s[1], A = alphas !== undefined

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		data[i] = x - (A ? alphas[i] : alpha) * x1
		x1 = x
	}

	s[0] = x1

	return data
}

/**
 * One block in place, allocating nothing: `s` a Float64Array of y1 (kept from call to call) and alpha; `alphas`, when
 * given, alpha each frame in its place
 */
export function deemphasisBlock (data, s, alphas) {
	let y1 = s[0], alpha = s[1], A = alphas !== undefined

	for (let i = 0, l = data.length; i < l; i++) {
		y1 = data[i] + (A ? alphas[i] : alpha) * y1
		data[i] = y1
	}

	s[0] = y1

	return data
}
