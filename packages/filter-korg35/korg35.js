/**
 * Korg MS-20 style filter (Korg35).
 * Zero-delay feedback (ZDF) via trapezoidal integration.
 *
 * Ref: Zavalishin, "The Art of VA Filter Design" (2012), Ch. 5.
 *      Stilson & Smith, "Analyzing the Korg MS-20 Filter" (1996).
 *
 * The Korg35 is a 2-pole filter with nonlinear feedback. Unlike SVF, it uses two
 * cascaded one-pole sections with the output fed back to the input. The nonlinear
 * saturation in the feedback path gives the aggressive MS-20 character.
 *
 * Lowpass: output from second stage.
 * Highpass: input minus lowpass output — exactly complementary only at
 * resonance=0; the feedback term in the HP tap makes LP+HP diverge from the
 * input as resonance increases (see readme).
 *
 * Only 2 real poles feed the resonance loop (vs. moog-ladder's 4), so the
 * loop phase never reaches -180° at any audible, non-negligible-gain
 * frequency: resonance adds damping/saturation character but no resonant
 * peak and no sustained self-oscillation at any resonance setting (see readme).
 *
 * @module  audio-filter/analog/korg35
 * @param {Float32Array|Float64Array} data - audio buffer (modified in place)
 * @param {Object} params
 * @param {number} [params.fc=1000] - cutoff frequency Hz
 * @param {number} [params.resonance=0] - resonance 0–1 (aggressive damping/saturation; no self-oscillation — see readme)
 * @param {number} [params.fs=44100] - sample rate
 * @param {number} [params.drive=1] - input drive (saturation amount)
 * @param {string} [params.type='lowpass'] - 'lowpass' or 'highpass'
 */

let {tan, tanh, PI, min} = Math

const SET = new Float64Array(4)   // a direct call's fc, resonance, drive, fs

export default function korg35 (data, params) {
	SET[0] = params.fc || 1000
	SET[1] = params.resonance != null ? params.resonance : 0
	SET[3] = params.fs || 44100
	SET[2] = params.drive ?? 1

	// State: 2 one-pole integrator states
	if (!params._s) params._s = new Float64Array(2)
	return korg35Block(data, params._s, SET, params.type === 'highpass')
}

/**
 * One block in place, allocating nothing: `s` the 2 integrator states (a Float64Array kept from call to call), `set` a
 * Float64Array of fc, resonance, drive and fs, `hp` the highpass tap. `fade`, when given and under way (korg35Fade
 * starts one), moves the output from the taps it had to this one's over its course
 */
export function korg35Block (data, s, set, hp, fade) {
	let fc = set[0], res = set[1], drive = set[2], fs = set[3]
	let F = fade && fade[0] < 1 ? fade : null

	// Trapezoidal integrator coefficient
	let g = tan(PI * min(fc, fs * 0.49) / fs)
	let G = g / (1 + g)         // one-pole gain
	let G2 = G * G              // two-pole gain
	let k = res * 2             // feedback coefficient: 0–2
	taps(W, hp, k)

	for (let i = 0, n = data.length; i < n; i++) {
		let x = data[i]
		// Estimate 2-pole output from state (zero-input cascade response)
		let S = G * s[0] + s[1]

		// Implicit feedback solve
		let u = (data[i] - k * S) / (1 + k * G2)

		// Nonlinear saturation in feedback path (MS-20 character)
		u = tanh(u * drive)

		// Two cascaded trapezoidal one-pole lowpass stages
		let y1 = G * (u - s[0]) + s[0]
		s[0] = 2 * y1 - s[0]

		let y2 = G * (y1 - s[1]) + s[1]
		s[1] = 2 * y2 - s[1]

		let out = hp ? data[i] - y2 - k * y2 : y2
		if (F !== null && F[0] < 1) { Y[0] = x; Y[1] = y2; out = faded(F, W, Y, 2) }
		data[i] = out
	}

	return data
}

const W = new Float64Array(2), Y = new Float64Array(2)   // a block's tap weights, a sample's taps: the input and y2

// The highpass tap is x − y2 − k·y2, the lowpass y2: their weights on x and y2
function taps (W, hp, k) { W[0] = hp ? 1 : 0; W[1] = hp ? -1 - k : 1; return W }

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
 * Starts a fade, or restarts one under way, toward the tap korg35Block is next given, from the taps the output has:
 * those of `hp` (the last given) at `set`'s resonance, or the blend of a fade under way. `fade` a Float64Array(4) of
 * where it is, its step a sample (1 / the samples it lasts) and the weights it begins from
 */
export function korg35Fade (fade, hp, set) {
	let t = fade[0], e = t * t * (3 - 2 * t)
	taps(W, hp, set[1] * 2)
	for (let k = 0; k < 2; k++) fade[2 + k] = t < 1 ? fade[2 + k] + e * (W[k] - fade[2 + k]) : W[k]
	fade[0] = 0
	return fade
}
