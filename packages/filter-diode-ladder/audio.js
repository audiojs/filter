// atom manifest — diode ladder ZDF filter (TB-303 class; per-stage tanh, self-oscillation ≈1.15) per @audio/compile CONTRACT.
// The kernel keeps its state on the params object — the manifest owns one persistent
// params object per channel, so state survives across blocks; params are live.
import diodeLadder from './diode-ladder.js'

export const diode = (ctx) => {
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
			out[c].set(inp[c])
			diodeLadder(out[c], p)
		}
	}
}
diode.channels = 'any'
diode.params = {
	fc:        { type: 'number', min: 20, max: 20000, default: 1000, unit: 'Hz', curve: 'log' },
	resonance: { type: 'number', min: 0, max: 1.2, default: 0 },
	drive:     { type: 'number', min: 0.1, max: 10, default: 1 },
}
