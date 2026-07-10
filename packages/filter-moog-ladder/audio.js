// atom manifest — Moog 4-pole ZDF ladder (−24 dB/oct LP, self-oscillates at resonance 1) per @audio/compile CONTRACT.
// The kernel keeps its state on the params object — the manifest owns one persistent
// params object per channel, so state survives across blocks; params are live.
import moogLadder from './moog-ladder.js'

export const moog = (ctx) => {
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
			moogLadder(out[c], p)
		}
	}
}
moog.channels = 'any'
moog.params = {
	fc:        { type: 'number', min: 20, max: 20000, default: 1000, unit: 'Hz', curve: 'log' },
	resonance: { type: 'number', min: 0, max: 1, default: 0 },
	drive:     { type: 'number', min: 0.1, max: 10, default: 1 },
}
