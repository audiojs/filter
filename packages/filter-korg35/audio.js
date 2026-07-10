// atom manifest — Korg35 MS-20 ZDF filter (2-pole, nonlinear feedback bite; no self-oscillation) per @audio/compile CONTRACT.
// The kernel keeps its state on the params object — the manifest owns one persistent
// params object per channel, so state survives across blocks; params are live.
import korg35Fn from './korg35.js'

export const korg35 = (ctx) => {
	const chP = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) chP.push({ fs: ctx.sampleRate })
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) {
			const p = chP[c]
			p.fc = params.fc[0]
			p.resonance = params.resonance[0]
			p.drive = params.drive[0]
			p.type = params.type
			out[c].set(inp[c])
			korg35Fn(out[c], p)
		}
	}
}
korg35.channels = 'any'
korg35.params = {
	fc:        { type: 'number', min: 20, max: 20000, default: 1000, unit: 'Hz', curve: 'log' },
	resonance: { type: 'number', min: 0, max: 1, default: 0 },
	drive:     { type: 'number', min: 0.1, max: 10, default: 1 },
	type:      { type: 'enum', values: ['lowpass', 'highpass'], default: 'lowpass' },
}
