// atom manifest — variable-bandwidth filter (per-sample smoothed fc/Q trajectory — click-free sweeps) per @audio/compile CONTRACT.
// The kernel keeps its state on the params object — the manifest owns one persistent
// params object per channel, so state survives across blocks; params are live.
import variableBandwidth from './variable-bandwidth.js'

export const variable = (ctx) => {
	const chP = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) chP.push({ fs: ctx.sampleRate })
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) {
			const p = chP[c]
			p.fc = params.fc[0]
			p.Q = params.Q[0]
			p.type = params.type
			out[c].set(inp[c])
			variableBandwidth(out[c], p)
		}
	}
}
variable.channels = 'any'
variable.params = {
	fc:   { type: 'number', min: 20, max: 20000, default: 1000, unit: 'Hz', curve: 'log' },
	Q:    { type: 'number', min: 0.1, max: 30, default: 0.707, curve: 'log' },
	type: { type: 'enum', values: ['lowpass', 'highpass', 'bandpass'], default: 'lowpass' },
}
