// atom manifest — pre-emphasis / de-emphasis one-pole pair per @audio/compile CONTRACT.
// One file, two atoms (the contract allows many exports per file). The kernels keep
// x1/y1 state on the params object — one persistent object per channel; alpha is live.

import { emphasis as emphasisFn, deemphasis as deemphasisFn } from './pre-emphasis.js'

const wrap = (fn) => (ctx) => {
	const chP = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) chP.push({})
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) {
			const p = chP[c]
			p.alpha = params.alpha[0]
			out[c].set(inp[c])
			fn(out[c], p)
		}
	}
}

export const emphasis = wrap(emphasisFn)
export const deemphasis = wrap(deemphasisFn)
emphasis.id = 'emphasis'
deemphasis.id = 'deemphasis'  // wrap() arrows have no .name — pin ids explicitly
emphasis.channels = deemphasis.channels = 'any'
emphasis.params = deemphasis.params = {
	alpha: { type: 'number', min: 0.5, max: 0.99, default: 0.97 },
}
