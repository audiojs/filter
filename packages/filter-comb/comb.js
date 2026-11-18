/**
 * Comb filter — feedforward (FIR) and feedback (IIR)
 *
 * The delay line is read as @audio/effect's delay reads its line: d samples back, between two samples where d is not a
 * whole frame; a new d glides across the call from where the last call ended, the read moving no faster than a tape
 * head allows.
 *
 * @module  audio-filter/effect/comb
 */

// The delay in samples a time (seconds) asks for, at least one so the feedback loop stays causal: @audio/effect's
// delaySamples. A host passes a time as a Float32: 10 ms arrives as 0.009999999776, 479.99999 frames at 48 kHz. Within a
// Float32 step (2^-23 of it) of a whole frame it is that frame, so such a time reads one sample, bit for bit as a line
// of whole frames read it; any other time reads between two samples
export function delaySamples (time, fs) {
	let d = time * fs, r = Math.round(d)
	if (Math.abs(d - r) <= r * 2 ** -23) d = r
	return Math.max(1, d)
}

// How far the read may move in a frame while the delay moves (@audio/effect's delay): no slower than half speed and no
// faster than double, a bend of an octave at most
const GROW = 0.5, SHRINK = 1

const ST = new Float64Array(3), SET = new Float64Array(3)   // a direct call's ptr, glide, and delay, gain, type

export default function comb (data, params) {
	let d = Math.max(1, params.delay)
	let gain = params.gain == null ? .5 : params.gain
	let type = params.type || 'feedforward'

	// a ring made for a longer delay holds this one; one too short is made anew, empty
	let glide = params._glide ??= new Float64Array(2).fill(NaN)
	if (!params.buffer || params.buffer.length < Math.floor(d) + 2) {
		params.buffer = new Float64Array(Math.floor(d) + 2)
		params.ptr = 0
		glide[0] = glide[1] = NaN
	}
	ST[0] = params.ptr; ST[1] = glide[0]; ST[2] = glide[1]
	SET[0] = d; SET[1] = gain; SET[2] = type === 'feedback' ? 1 : 0
	combBlock(data, params.buffer, ST, SET)
	params.ptr = ST[0]; glide[0] = ST[1]; glide[1] = ST[2]

	return data
}

/**
 * One block in place, allocating nothing: `buf` the ring, at least floor(d) + 2 long (made for the longest delay), `s` a
 * Float64Array of the write position, the delay the last call ended on and where its read was (NaN before the first
 * call), kept from call to call; `set` one of the delay in samples (≥ 1), the gain, and 1 for feedback, 0 feedforward.
 * A new delay is reached across the call from the last call's, the read following that line at up to GROW and SHRINK
 * frames a frame, a farther move going on in the calls after. `gains`, when given, is the gain each frame, in its place
 */
export function combBlock (data, buf, s, set, gains) {
	let N = buf.length, ptr = s[0], d = set[0], gain = set[1], fb = set[2] === 1, G = gains !== undefined
	let from = s[1] === s[1] ? s[1] : d, glide = d - from, at = s[2] >= 1 ? s[2] : from

	for (let i = 0, l = data.length; i < l; i++) {
		let want = from + glide * (i + 1) / l
		at = want > at + GROW ? at + GROW : want < at - SHRINK ? at - SHRINK : want
		let D = Math.floor(at), f = at - D
		let r = ptr - D
		if (r < 0) r += N
		let delayed = buf[r]
		if (f) delayed += f * (buf[r ? r - 1 : N - 1] - delayed)
		let x = data[i], y = x + (G ? gains[i] : gain) * delayed
		buf[ptr] = fb ? y : x
		if (++ptr === N) ptr = 0
		data[i] = y
	}

	s[0] = ptr
	s[1] = d
	s[2] = at

	return data
}
