// atom manifest — variable-bandwidth filter (per-sample smoothed fc/Q trajectory — click-free sweeps) per @audio/compile CONTRACT.
// Each channel's state (the section's and the smoothed fc and Q) is a Float64Array made here, and each sample's
// coefficients are computed in variableBlock itself, so a block allocates nothing; params are live. A new type moves the
// output from the old type to the new over FADE seconds (variableFade), as the ladders' taps move: a type switched in
// one sample would click.
import { variableBlock, variableFade } from './variable-bandwidth.js'
import { lowpass, highpass, bandpass, tail } from '@audio/biquad'

const FADE = 0.02

export const variable = (ctx) => {
	const st = [], fades = [], set = new Float64Array(3), c = lowpass(1000, 0.707, ctx.sampleRate), was = Int32Array.of(-1)   // set: target fc, Q, and fs; was: the type in force
	for (let ch = 0; ch < ctx.maxChannels; ch++) {
		st.push(Float64Array.of(0, 0, NaN, NaN))   // z1, z2, smoothed fc and Q
		fades.push(Float64Array.of(1, 1 / (FADE * ctx.sampleRate), 0, 0, 0, 0))   // where a fade is, its step, the weights it began from, the form
	}
	set[2] = ctx.sampleRate
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0], type = params.type, k = TYPES.indexOf(type)
		if (k !== was[0]) {
			if (was[0] >= 0) for (let ch = 0; ch < fades.length; ch++) variableFade(fades[ch], TYPES[was[0]])
			was[0] = k
		}
		set[0] = params.fc[0]
		set[1] = params.Q[0]
		for (let ch = 0; ch < inp.length; ch++) {
			out[ch].set(inp[ch])
			variableBlock(out[ch], st[ch], set, c, type, fades[ch])
		}
	}
}
variable.channels = 'any'
variable.params = {
	fc:   { type: 'number', min: 20, max: 20000, default: 1000, unit: 'Hz', curve: 'log' },
	Q:    { type: 'number', min: 0.1, max: 30, default: 0.707, curve: 'log' },
	type: { type: 'enum', values: ['lowpass', 'highpass', 'bandpass'], default: 'lowpass' },
}
const TYPES = variable.params.type.values
// The tail at the values in force: that of the section the smoothing settles on, fc held as variableBlock holds it, by
// @audio/biquad's rule (its 5 ms glide is not counted, nor a fade's old type)
const DESIGN = { lowpass, highpass, bandpass }
variable.tail = ({ sampleRate, params }) => tail(DESIGN[params.type](Math.min(params.fc[0], sampleRate * 0.49), params.Q[0], sampleRate), sampleRate)
