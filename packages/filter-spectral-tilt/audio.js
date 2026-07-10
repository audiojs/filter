// atom manifest — spectral tilt (cascade of shelved one-poles approximating a dB/oct slope) per @audio/compile CONTRACT.
// The kernel keeps its state on the params object — the manifest owns one persistent
// params object per channel, so state survives across blocks; params are live.
// slope changes rebuild coefficients (kernel self-detects) — live is fine.
import spectralTiltFn from './spectral-tilt.js'

export const spectralTilt = (ctx) => {
	const chP = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) chP.push({ fs: ctx.sampleRate })
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) {
			const p = chP[c]
			p.slope = params.slope[0]
			out[c].set(inp[c])
			spectralTiltFn(out[c], p)
		}
	}
}
spectralTilt.channels = 'any'
spectralTilt.params = {
	slope: { type: 'number', min: -6, max: 6, default: 0, unit: 'dB/oct' },
}
