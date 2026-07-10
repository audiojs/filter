// atom manifest — two-pole resonator (ringing bandpass at fc with bandwidth bw) per @audio/compile CONTRACT.
// The kernel keeps its state on the params object — the manifest owns one persistent
// params object per channel, so state survives across blocks; params are live.
import resonatorFn from './resonator.js'

export const resonator = (ctx) => {
	const chP = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) chP.push({ fs: ctx.sampleRate })
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) {
			const p = chP[c]
			p.fc = params.fc[0]
			p.bw = params.bw[0]
			out[c].set(inp[c])
			resonatorFn(out[c], p)
		}
	}
}
resonator.channels = 'any'
resonator.tail = 0.5
resonator.params = {
	fc: { type: 'number', min: 20, max: 20000, default: 440, unit: 'Hz', curve: 'log' },
	bw: { type: 'number', min: 1, max: 2000, default: 50, unit: 'Hz', curve: 'log' },
}
