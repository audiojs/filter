// atom manifest — pre-emphasis / de-emphasis one-pole pair per @audio/compile CONTRACT.
// One file, two atoms (the contract allows many exports per file). Each channel's state (x1 or y1, and the live alpha)
// is a Float64Array made here, so a block allocates nothing; alpha is live. alpha scales the last sample, so it is
// smoothed (20 ms) and glided sample by sample (glide, below): a host's ramp of it is one line however the host cut its
// calls; held, the kernel runs on it as it is.

import { emphasisBlock, deemphasisBlock } from './pre-emphasis.js'

const wrap = (block) => (ctx) => {
	const st = [], g = new Float64Array(GLIDE).fill(NaN), alphas = new Float64Array(ctx.maxBlockSize)
	for (let c = 0; c < ctx.maxChannels; c++) st.push(new Float64Array(2))
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0], alpha = params.alpha[0], ramp = glide(g, 0, params.alpha, alphas, 0, inp[0].length, 0) ? alphas : undefined
		for (let c = 0; c < inp.length; c++) {
			st[c][1] = alpha
			out[c].set(inp[c])
			block(out[c], st[c], ramp)
		}
	}
}

export const emphasis = wrap(emphasisBlock)
export const deemphasis = wrap(deemphasisBlock)
emphasis.id = 'emphasis'
deemphasis.id = 'deemphasis'  // wrap() arrows have no .name — pin ids explicitly
emphasis.channels = deemphasis.channels = 'any'
emphasis.params = deemphasis.params = {
	alpha: { type: 'number', min: 0.5, max: 0.99, default: 0.97, smoothing: 0.02 },
}
// The tail at the values in force, by @audio/biquad's rule (the frames until the rest of the impulse response, Σ|h|
// from there on, is under 1e-3; 0 at 128 frames or under). De-emphasis's h is alphaⁿ: from frame N on its sum is
// alpha^N/(1 − alpha), under 1e-3 from N = ln(1000/(1 − alpha))/ln(1/alpha) (a DC step stopping rings exactly so).
// Pre-emphasis rings one sample: no tail.
deemphasis.tail = ({ sampleRate, params }) => { let a = params.alpha[0], T = Math.ceil(Math.log(1000 / (1 - a)) / Math.log(1 / a)) - 1; return T <= 128 ? 0 : T / sampleRate }

// A value that scales the signal, glided sample by sample so that a host's steps of it join into one line. A host hands
// each call the value at its first frame and, while a value moves (a `smoothing` ramp), calls with 32 frames at most
// (contract 1.0: Parameters, Time; What a host owes, 3). So the line through the values the calls bring, each at its
// call's first frame, is known 32 frames behind any call's first frame, however the host cut the calls; the glide plays
// it 32 frames late. Straight from the value of one call to the next's, it is the host's ramp itself, in the value's
// own unit, the same whether the host calls with 1, 32 or a mix of frames; drawn between each call's end and the next
// (a glide across each call), a ramp cut 32, 4, 32 would put 32 frames of it into 4. A value that follows a call of
// more than 32 frames came with no ramp: it is reached in a straight line over 32 frames. The first call of an
// instance starts on its value, and a value held 32 frames is the value itself, so a value that does not move is
// bit for bit what it was before the glide existed.
// `g`: the memory, GLIDE slots a value from j·GLIDE (made NaN): the value the last call brought, where in the ring its
// first frame is, its frames, the frames the line had been at that value before it (64 once held and the ring all of
// it; counted to 63 at most, so that a long call after a move cannot reach 64 before the ring is made all of it), how
// many of `row`'s hold it, then the line, a frame a slot, in a ring of 64. `src`: the param's array. The
// line's values for this call's `n` frames go to `row` from `at`: as they are, or with `lin` 1 the gain e^(v·ln10/20)
// of a value in dB, per sample, so the gain follows the host's ramp of the dB value. Returns 1 while they move, 0 when
// every one is the value (then `row` holds it, filled once, and a caller may run its kernel on the value alone). Only
// arrays and whole numbers cross the call.
const GLIDE = 69
function glide(g, j, src, row, at, n, lin) {
	let o = j * GLIDE, r = o + 5, v = src[0], was = g[o]
	if (!(was === was)) { g[o] = v; g[o + 1] = 0; g[o + 2] = n; g[o + 3] = 0; g[o + 4] = 0 }
	else if (v !== was || g[o + 3] < 64) {
		let len = g[o + 2], L = len < 32 ? len : 32, w = (g[o + 1] + len) & 63, d = v - was, held = v === was ? Math.min(g[o + 3] + len, 63) : 0
		for (let q = 0; q < L; q++) g[r + ((w - L + q) & 63)] = was + d * q / L
		g[r + w] = v
		g[o] = v; g[o + 1] = w; g[o + 2] = n; g[o + 3] = held; g[o + 4] = 0
		if (held < 32) {
			for (let i = 0; i < n; i++) {
				let u = i < 32 ? g[r + ((w + i - 32) & 63)] : v
				row[at + i] = lin ? Math.exp(u * (Math.LN10 / 20)) : u
			}
			return 1
		}
	} else { g[o + 1] = (g[o + 1] + g[o + 2]) & 63; g[o + 2] = n }
	// held 32 frames: the ring made all of the value once (a move from it reads the line from there), the row filled
	// with it as far as no call since it was held has filled it; from then on a call only moves the ring's position
	if (g[o + 3] < 64) { for (let q = 0; q < 64; q++) g[r + q] = v; g[o + 3] = 64 }
	if (g[o + 4] < n) {
		let u = lin ? Math.exp(v * (Math.LN10 / 20)) : v
		for (let i = 0; i < n; i++) row[at + i] = u
		g[o + 4] = n
	}
	return 0
}
