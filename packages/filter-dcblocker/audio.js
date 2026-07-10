// atom manifest — DC blocker — H(z) = (1 − z⁻¹)/(1 − R·z⁻¹) per @audio/compile CONTRACT.
// The kernel keeps its state on the params object — the manifest owns one persistent
// params object per channel, so state survives across blocks; params are live.
import dcBlocker from './dc-blocker.js'

export const dcblocker = (ctx) => {
	const chP = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) chP.push({ fs: ctx.sampleRate })
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) {
			const p = chP[c]
			p.R = params.R[0]
			out[c].set(inp[c])
			dcBlocker(out[c], p)
		}
	}
}
dcblocker.channels = 'any'
dcblocker.params = {
	R: { type: 'number', min: 0.9, max: 0.9999, default: 0.995 },
}
