/**
 * DC blocking filter
 * H(z) = (1 - z^-1) / (1 - R*z^-1)
 *
 * @module  audio-filter/effect/dc-blocker
 */

const S = new Float64Array(3)   // a direct call's x1, y1, R

export default function dcBlocker (data, params) {
	let R = params.R
	if (R == null) R = .995
	S[0] = params.x1 != null ? params.x1 : 0
	S[1] = params.y1 != null ? params.y1 : 0
	S[2] = R

	dcBlock(data, S)

	params.x1 = S[0]
	params.y1 = S[1]

	return data
}

/** One block in place, allocating nothing: `s` a Float64Array of x1, y1 (kept from call to call) and R */
export function dcBlock (data, s) {
	let x1 = s[0], y1 = s[1], R = s[2]

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let y = x - x1 + R * y1
		x1 = x
		y1 = y
		data[i] = y
	}

	s[0] = x1
	s[1] = y1

	return data
}
