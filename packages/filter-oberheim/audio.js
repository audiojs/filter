// atom manifest — Oberheim SEM-class ZDF multimode (LP/HP/BP/notch from one 2-pole core) per @audio/compile CONTRACT.
// The kernel keeps its state on the params object — the manifest owns one persistent
// params object per channel, so state survives across blocks; params are live.
import oberheimFn from './oberheim.js'

export const oberheim = (ctx) => {
	const chP = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) chP.push({ fs: ctx.sampleRate })
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) {
			const p = chP[c]
			p.fc = params.fc[0]
			p.resonance = params.resonance[0]
			p.type = params.type
			out[c].set(inp[c])
			oberheimFn(out[c], p)
		}
	}
}
oberheim.channels = 'any'
oberheim.params = {
	fc:        { type: 'number', min: 20, max: 20000, default: 1000, unit: 'Hz', curve: 'log' },
	resonance: { type: 'number', min: 0, max: 1, default: 0 },
	type:      { type: 'enum', values: ['lowpass', 'highpass', 'bandpass', 'notch'], default: 'lowpass' },
}
