// atom manifest — derivative / integral first-difference & running-sum pair per @audio/compile CONTRACT.
// One file, two atoms. Each channel's running state (prev, or acc and the live leak) is a Float64Array made here, so a
// block allocates nothing; leak is live.

import { derivativeBlock, integralBlock } from './derivative.js'

export const derivative = (ctx) => {
	const st = []
	for (let c = 0; c < ctx.maxChannels; c++) st.push(new Float64Array(1))
	return (inputs, outputs) => {
		const inp = inputs[0], out = outputs[0]
		for (let c = 0; c < inp.length; c++) {
			out[c].set(inp[c])
			derivativeBlock(out[c], st[c])
		}
	}
}
export const integral = (ctx) => {
	const st = []
	for (let c = 0; c < ctx.maxChannels; c++) st.push(new Float64Array(2))
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0], leak = params.leak[0]
		for (let c = 0; c < inp.length; c++) {
			st[c][1] = leak
			out[c].set(inp[c])
			integralBlock(out[c], st[c])
		}
	}
}
derivative.channels = integral.channels = 'any'
derivative.params = {}
integral.params = {
	leak: { type: 'number', min: 0.9, max: 1, default: 1 },
}
// The tail at the values in force, by @audio/biquad's rule (the frames until the rest of the impulse response, Σ|h|
// from there on, is under 1e-3; 0 at 128 frames or under). The integral's h is leakⁿ: from frame N on its sum is
// leak^N/(1 − leak), under 1e-3 from N = ln(1000/(1 − leak))/ln(1/leak) (a DC step stopping rings exactly so). At leak 1
// the sum holds what it summed: Infinity. The derivative's ring is one sample: no tail.
integral.tail = ({ sampleRate, params }) => { let k = params.leak[0], T = Math.ceil(Math.log(1000 / (1 - k)) / Math.log(1 / k)) - 1; return T <= 128 ? 0 : T / sampleRate }
