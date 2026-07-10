// atom manifest — comb filter (feedforward FIR notches / feedback IIR resonances) per @audio/compile CONTRACT.
// The kernel keeps its state on the params object — the manifest owns one persistent
// params object per channel, so state survives across blocks; params are live.
// delay is declared in ms and mapped to samples; the kernel resizes (and resets) its own buffer on change.
import combFn from './comb.js'

export const comb = (ctx) => {
	const chP = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) chP.push({ fs: ctx.sampleRate })
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) {
			const p = chP[c]
			p.delay = Math.max(1, Math.round(params.delay[0] * ctx.sampleRate / 1000))
			p.gain = params.gain[0]
			p.type = params.type
			out[c].set(inp[c])
			combFn(out[c], p)
		}
	}
}
comb.channels = 'any'
comb.tail = 0.5
comb.params = {
	delay: { type: 'number', min: 0.05, max: 100, default: 10, unit: 'ms', curve: 'log' },
	gain:  { type: 'number', min: -0.99, max: 0.99, default: 0.5 },
	type:  { type: 'enum', values: ['feedforward', 'feedback'], default: 'feedforward' },
}
