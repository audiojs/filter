/**
 * Derivative / integral — first-difference & running-sum pair
 * Reference: FFmpeg libavfilter/af_aderivative.c DERIVATIVE / INTEGRAL macros.
 * Differential-verified vs ffmpeg 8.0.1: derivative bit-exact (chunked, stateful); integral
 * matches a float32 accumulator bit-exactly — the double accumulator here is strictly more accurate.
 *
 * @module  audio-filter/effect/derivative
 */

const S = new Float64Array(2)   // a direct call's prev, or acc and leak

export function derivative (data, params) {
	S[0] = params.prev != null ? params.prev : 0
	derivativeBlock(data, S)
	params.prev = S[0]
	return data
}

export function integral (data, params) {
	S[1] = params.leak != null ? params.leak : 1  // 1 = exact FFmpeg INTEGRAL; <1 is our anti-drift extension
	S[0] = params.acc != null ? params.acc : 0
	integralBlock(data, S)
	params.acc = S[0]
	return data
}

/** One block in place, allocating nothing: `s` a Float64Array holding prev, kept from call to call */
export function derivativeBlock (data, s) {
	let prev = s[0]

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		data[i] = x - prev  // dst[n] = src[n] - prv[0]
		prev = x            // prv[0] = src[n]
	}

	s[0] = prev

	return data
}

/** One block in place, allocating nothing: `s` a Float64Array of acc (kept from call to call) and leak */
export function integralBlock (data, s) {
	let acc = s[0], leak = s[1]

	for (let i = 0, l = data.length; i < l; i++) {
		acc = acc * leak + data[i]  // leak=1: dst[n] = prv[0] + src[n]
		data[i] = acc               // prv[0] = dst[n]
	}

	s[0] = acc

	return data
}
