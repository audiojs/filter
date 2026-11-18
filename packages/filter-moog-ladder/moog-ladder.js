/**
 * Moog 4-pole transistor ladder filter (-24 dB/oct lowpass with resonance).
 * Zero-delay feedback (ZDF) via trapezoidal integration.
 *
 * Ref: Zavalishin, "The Art of VA Filter Design" (2012), Ch. 6.
 *      Välimäki & Smith, "Discrete-Time Synthesis of the Moog VCF" (2006).
 *
 * 4 cascaded one-pole trapezoidal integrators with implicit feedback solving.
 * No unit delay in feedback path — resonance tracks cutoff accurately to Nyquist.
 *
 * Modes mix the ladder's taps: y0 the saturated input, y1..y4 its stages. A stage is a one-pole
 * lowpass L, so (1 − L)ⁿ is highpass and Lⁿ(1 − L)ⁿ bandpass, their binomials the weights
 * (Zavalishin 2012, §5.5; the same as JUCE's dsp::LadderFilter modes, which Pedalboard exposes).
 *
 * @module  audio-filter/analog/moog-ladder
 * @param {Float32Array|Float64Array} data - audio buffer (modified in place)
 * @param {Object} params
 * @param {number} [params.fc=1000] - cutoff frequency Hz
 * @param {number} [params.resonance=0] - resonance 0–1 (self-oscillation at 1)
 * @param {number} [params.fs=44100] - sample rate
 * @param {number} [params.drive=1] - input drive (saturation amount)
 * @param {string} [params.type='lowpass'] - lowpass, highpass or bandpass
 * @param {number} [params.poles=4] - 4 (-24 dB/oct; bandpass ±12) or 2 (-12 dB/oct; bandpass ±6)
 */

let {tan, tanh, PI, min} = Math

// weights of y0..y4 for each type and pole count
const MODES = {
	lowpass:  { 2: [0, 0, 1, 0, 0],  4: [0, 0, 0, 0, 1] },
	highpass: { 2: [1, -2, 1, 0, 0], 4: [1, -4, 6, -4, 1] },
	bandpass: { 2: [0, 1, -1, 0, 0], 4: [0, 0, 1, -2, 1] },
}

const SET = new Float64Array(4)   // a direct call's fc, resonance, drive, fs

export default function moogLadder (data, params) {
	SET[0] = params.fc || 1000
	SET[1] = params.resonance != null ? params.resonance : 0
	SET[3] = params.fs || 44100
	SET[2] = params.drive ?? 1
	let type = params.type || 'lowpass', poles = params.poles ?? 4
	if (!MODES[type]?.[poles]) throw new RangeError(`moogLadder: type is lowpass, highpass or bandpass, poles 2 or 4 (got ${params.type}, ${params.poles})`)

	// State: 4 one-pole integrator states
	if (!params._s) params._s = new Float64Array(4)
	return moogBlock(data, params._s, SET, type, poles)
}

/**
 * One block in place, allocating nothing: `s` the 4 integrator states (a Float64Array kept from call to call), `set` a
 * Float64Array of fc, resonance, drive and fs, `type` lowpass, highpass or bandpass, `poles` 2 or 4. `fade`, when given
 * and under way (moogFade starts one), moves the output from the taps it had to this type's over its course
 */
export function moogBlock (data, s, set, type, poles, fade) {
	let fc = set[0], res = set[1], drive = set[2], fs = set[3]
	let A = MODES[type][poles], F = fade && fade[0] < 1 ? fade : null

	// Trapezoidal integrator coefficient
	let g = tan(PI * min(fc, fs * 0.49) / fs)
	let G = g / (1 + g)            // one-pole gain factor
	let G2 = G * G, G3 = G2 * G, G4 = G3 * G
	let k = res * 4                // feedback coefficient: 0–4, self-oscillation at 4

	for (let i = 0, n = data.length; i < n; i++) {
		// Estimate output from current state (zero-input response of cascade): a stage outputs
		// y = G·v + s/(1+g), so y4 = G⁴·u + S with S its states propagated through the cascade
		let S = (G3 * s[0] + G2 * s[1] + G * s[2] + s[3]) * (1 - G)

		// Implicit feedback solve: u*(1 + k*G^4) = input - k*S
		let u = (data[i] - k * S) / (1 + k * G4)

		// Nonlinear saturation at input (transistor ladder characteristic)
		u = tanh(u * drive)

		// 4 cascaded trapezoidal one-pole lowpass stages
		let v = u, out = A[0] * u
		Y[0] = u
		for (let j = 0; j < 4; j++) {
			let y = G * (v - s[j]) + s[j]   // trapezoidal integrator output
			s[j] = 2 * y - s[j]             // state update (2y - s for trapezoidal rule)
			v = y
			out += A[j + 1] * y
			Y[j + 1] = y
		}
		if (F !== null && F[0] < 1) out = faded(F, A, Y, 5)

		data[i] = out
	}

	return data
}

const Y = new Float64Array(5)   // this sample's taps y0..y4

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
 * Starts a fade, or restarts one under way, toward the taps moogBlock is next given, from the taps the output has: those
 * of `type` and `poles` (the last given), or the blend of a fade under way. `fade` a Float64Array(7) of where it is, its
 * step a sample (1 / the samples it lasts) and the weights it begins from
 */
export function moogFade (fade, type, poles) {
	let A = MODES[type][poles], t = fade[0], e = t * t * (3 - 2 * t)
	for (let k = 0; k < 5; k++) fade[2 + k] = t < 1 ? fade[2 + k] + e * (A[k] - fade[2 + k]) : A[k]
	fade[0] = 0
	return fade
}
