// atom manifest — biquad filters with live freq/Q (native atoms re-derive
// coefficients on param change; per-channel state rides the params objects).

import hpFn from './highpass.js'
import lpFn from './lowpass.js'
import bpFn from './bandpass.js'

const MAX_CH = 8
const FREQ_Q = {
	fc: { type: 'number', min: 20, max: 20000, default: 1000, curve: 'log', unit: 'Hz', smoothing: 0.02 },
	Q:  { type: 'number', min: 0.1, max: 20, default: 0.707 },
}
const wrap = fn => (ctx) => {
	const chP = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) chP.push({ fs: ctx.sampleRate })
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) {
			const p = chP[c]
			p.fc = params.fc[0]
			p.Q = params.Q[0]
			out[c].set(inp[c])
			fn(out[c], p)
		}
	}
}

export const highpass = wrap(hpFn)
export const lowpass = wrap(lpFn)
export const bandpass = wrap(bpFn)
highpass.channels = lowpass.channels = bandpass.channels = 'any'
highpass.params = lowpass.params = bandpass.params = FREQ_Q
