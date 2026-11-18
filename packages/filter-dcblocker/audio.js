// atom manifest — DC blocker — H(z) = (1 − z⁻¹)/(1 − R·z⁻¹) per @audio/compile CONTRACT.
// Each channel's state (x1, y1 and the live R) is a Float64Array made here, so a block allocates nothing; R is live.
import { dcBlock } from './dc-blocker.js'

export const dcblocker = (ctx) => {
	const st = []
	for (let c = 0; c < ctx.maxChannels; c++) st.push(new Float64Array(3))
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0], R = params.R[0]
		for (let c = 0; c < inp.length; c++) {
			st[c][2] = R
			out[c].set(inp[c])
			dcBlock(out[c], st[c])
		}
	}
}
dcblocker.channels = 'any'
dcblocker.params = {
	R: { type: 'number', min: 0.9, max: 0.9999, default: 0.995 },
}
// The tail at the values in force, by @audio/biquad's rule (the frames until the rest of the impulse response, Σ|h|
// from there on, is under 1e-3; 0 at 128 frames or under). h is 1, then (R − 1)·R^(n−1): from frame N on its |h| sum to
// R^(N−1), under 1e-3 past ln(1000)/ln(1/R) frames (a DC step stopping rings exactly so)
dcblocker.tail = ({ sampleRate, params }) => { let T = Math.ceil(Math.log(1000) / Math.log(1 / params.R[0])); return T <= 128 ? 0 : T / sampleRate }
