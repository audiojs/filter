/**
 * Oberheim SEM state-variable filter (–12 dB/oct multimode).
 * Zero-delay feedback (ZDF) via trapezoidal integration.
 *
 * Ref: Zavalishin, "The Art of VA Filter Design" (2012), Ch. 4–5.
 *
 * 2-pole SVF with continuous mode selection (lowpass, highpass, bandpass, notch).
 * Two trapezoidal integrators with tanh saturation in the feedback path
 * give the warm, musical character of the original SEM hardware.
 *
 * @module  audio-filter/analog/oberheim
 * @param {Float32Array|Float64Array} data - audio buffer (modified in place)
 * @param {Object} params
 * @param {number} [params.fc=1000] - cutoff frequency Hz
 * @param {number} [params.resonance=0] - resonance 0–1 (max resonance at 1)
 * @param {number} [params.fs=44100] - sample rate
 * @param {string} [params.type='lowpass'] - 'lowpass'|'highpass'|'bandpass'|'notch'
 */

let {tan, tanh, PI, min} = Math

const SET = new Float64Array(3)   // a direct call's fc, resonance, fs

export default function oberheim (data, params) {
	SET[0] = params.fc || 1000
	SET[1] = params.resonance != null ? params.resonance : 0
	SET[2] = params.fs || 44100

	// State: 2 integrator states (bandpass, lowpass)
	if (!params._s) params._s = new Float64Array(2)
	return oberheimBlock(data, params._s, SET, params.type || 'lowpass')
}

/**
 * One block in place, allocating nothing: `s` the 2 integrator states (a Float64Array kept from call to call), `set` a
 * Float64Array of fc, resonance and fs, `type` lowpass, highpass, bandpass or notch. `fade`, when given and under way
 * (oberheimFade starts one), moves the output from the taps it had to this type's over its course
 */
export function oberheimBlock (data, s, set, type, fade) {
	let fc = set[0], res = set[1], fs = set[2]
	let F = fade && fade[0] < 1 ? fade : null, W = TAPS[type]

	// Trapezoidal integrator coefficient
	let g = tan(PI * min(fc, fs * 0.49) / fs)
	let R = 1 - res               // damping: 1 = no resonance, 0 = max resonance

	for (let i = 0, n = data.length; i < n; i++) {
		// Implicit solve for highpass (ZDF: no unit delay in feedback)
		let hp = (data[i] - 2 * R * s[0] - g * s[0] - s[1]) / (1 + 2 * R * g + g * g)

		// Bandpass integrator (trapezoidal)
		let bp = g * hp + s[0]
		s[0] = g * hp + bp

		// Lowpass integrator (trapezoidal)
		let lp = g * bp + s[1]
		s[1] = g * bp + lp

		// Saturate feedback states (analog character)
		s[0] = tanh(s[0])
		s[1] = tanh(s[1])

		// Mode select
		let out = type === 'bandpass' ? bp
			: type === 'highpass' ? hp
			: type === 'notch' ? hp + lp
			: lp
		if (F !== null && F[0] < 1) { Y[0] = hp; Y[1] = bp; Y[2] = lp; out = faded(F, W, Y, 3) }
		data[i] = out
	}

	return data
}

// each type's weights on the taps hp, bp, lp; a sample's taps
const TAPS = { lowpass: [0, 0, 1], highpass: [1, 0, 0], bandpass: [0, 1, 0], notch: [1, 0, 1] }, Y = new Float64Array(3)

// A fade from one set of tap weights to another: `fade` a Float64Array of where it is (0 to 1), its step a sample, and
// the weights the output had when it began. This sample's output, the weights moving along t²(3 − 2t), which sets off
// and arrives with no slope: no corner for the ear to hear. Then one step on. The same lines
// are in the moog ladder, korg35 and oberheim, none of which depends on another
function faded (F, A, Y, n) {
	let t = F[0], e = t * t * (3 - 2 * t), out = 0
	for (let k = 0; k < n; k++) out += (F[2 + k] + e * (A[k] - F[2 + k])) * Y[k]
	F[0] = t + F[1] < 1 ? t + F[1] : 1
	return out
}

/**
 * Starts a fade, or restarts one under way, toward the type oberheimBlock is next given, from the taps the output has:
 * those of `type` (the last given), or the blend of a fade under way. `fade` a Float64Array(5) of where it is, its step
 * a sample (1 / the samples it lasts) and the weights it begins from
 */
export function oberheimFade (fade, type) {
	let W = TAPS[type], t = fade[0], e = t * t * (3 - 2 * t)
	for (let k = 0; k < 3; k++) fade[2 + k] = t < 1 ? fade[2 + k] + e * (W[k] - fade[2 + k]) : W[k]
	fade[0] = 0
	return fade
}
