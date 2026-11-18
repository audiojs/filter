// atom manifest — biquad filters with live freq/Q: @audio/biquad designs the section in place when a value moves (against
// the last call's), and each channel's state is a Float64Array made here, so a block allocates nothing. fc is held to
// 0.49 of the rate, as the ladders hold it: above Nyquist the design has poles outside the unit circle. fc and Q retune
// the section: a host ramps them (smoothing 0.02), the section designed again at each call's values.

import { highpass as hpCoefs, lowpass as lpCoefs, bandpass as bpCoefs, process, tail } from '@audio/biquad'

const FREQ_Q = {
	fc: { type: 'number', min: 20, max: 20000, default: 1000, curve: 'log', unit: 'Hz', smoothing: 0.02 },
	Q:  { type: 'number', min: 0.1, max: 20, default: 0.707, smoothing: 0.02 },
}
const wrap = design => {
	const atom = (ctx) => {
		const fs = ctx.sampleRate, top = fs * 0.49, st = [], last = Float64Array.of(NaN, NaN)   // the fc and Q the section has
		let c = design(1000, 0.707, fs)
		for (let ch = 0; ch < ctx.maxChannels; ch++) st.push(new Float64Array(2))
		return (inputs, outputs, params) => {
			const inp = inputs[0], out = outputs[0], fc = Math.min(params.fc[0], top), Q = params.Q[0]
			// both compared, not short-circuited: with || V8 (Node 25.9) boxed a number at each retune where fc alone moved
			if ((fc !== last[0]) | (Q !== last[1])) { c = design(fc, Q, fs, c); last[0] = fc; last[1] = Q }
			for (let ch = 0; ch < inp.length; ch++) {
				out[ch].set(inp[ch])
				process(out[ch], c, st[ch])
			}
		}
	}
	// the tail at the values in force: the section's, by @audio/biquad's rule
	atom.tail = ({ sampleRate, params }) => tail(design(Math.min(params.fc[0], sampleRate * 0.49), params.Q[0], sampleRate), sampleRate)
	atom.channels = 'any'
	atom.params = FREQ_Q
	return atom
}

export const highpass = wrap(hpCoefs)
export const lowpass = wrap(lpCoefs)
export const bandpass = wrap(bpCoefs)
highpass.id = 'highpass'
lowpass.id = 'lowpass'
bandpass.id = 'bandpass'  // wrap() arrows have no .name: pin ids explicitly
