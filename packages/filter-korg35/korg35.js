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

export default function korg35 (data, params) {
	let fc = params.fc || 1000
	let res = params.resonance != null ? params.resonance : 0
	let fs = params.fs || 44100
	let drive = params.drive ?? 1
	let hp = params.type === 'highpass'

	// Trapezoidal integrator coefficient
	let g = tan(PI * min(fc, fs * 0.49) / fs)
	let G = g / (1 + g)         // one-pole gain
	let G2 = G * G              // two-pole gain
	let k = res * 2             // feedback coefficient: 0–2

	// State: 2 one-pole integrator states
	if (!params._s) params._s = new Float64Array(2)
	let s = params._s

	for (let i = 0, n = data.length; i < n; i++) {
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

		data[i] = hp ? data[i] - y2 - k * y2 : y2
	}

	return data
}
