/**
 * Derivative / integral — first-difference & running-sum pair
 * Reference: FFmpeg libavfilter/af_aderivative.c DERIVATIVE / INTEGRAL macros.
 * Differential-verified vs ffmpeg 8.0.1: derivative bit-exact (chunked, stateful); integral
 * matches a float32 accumulator bit-exactly — the double accumulator here is strictly more accurate.
 *
 * @module  audio-filter/effect/derivative
 */

export function derivative (data, params) {
	let prev = params.prev != null ? params.prev : 0

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		data[i] = x - prev  // dst[n] = src[n] - prv[0]
		prev = x            // prv[0] = src[n]
	}

	params.prev = prev

	return data
}

export function integral (data, params) {
	let leak = params.leak != null ? params.leak : 1  // 1 = exact FFmpeg INTEGRAL; <1 is our anti-drift extension
	let acc = params.acc != null ? params.acc : 0

	for (let i = 0, l = data.length; i < l; i++) {
		acc = acc * leak + data[i]  // leak=1: dst[n] = prv[0] + src[n]
		data[i] = acc               // prv[0] = dst[n]
	}

	params.acc = acc

	return data
}
