// atom manifest — derivative / integral first-difference & running-sum pair per @audio/compile CONTRACT.
// One file, two atoms. Kernels keep their running state (prev / acc) on the params object —
// one persistent object per channel; leak is live.

import { derivative as derivativeFn, integral as integralFn } from './derivative.js'

const wrap = (fn, copyParams) => (ctx) => {
	const chP = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) chP.push({})
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) {
			const p = chP[c]
			copyParams?.(p, params)
			out[c].set(inp[c])
			fn(out[c], p)
		}
	}
}

export const derivative = wrap(derivativeFn)
export const integral = wrap(integralFn, (p, params) => { p.leak = params.leak[0] })
derivative.id = 'derivative'
integral.id = 'integral'  // wrap() arrows have no .name — pin ids explicitly
derivative.channels = integral.channels = 'any'
derivative.params = {}
integral.params = {
	leak: { type: 'number', min: 0.9, max: 1, default: 1 },
}
