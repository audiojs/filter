/**
 * Diode ladder filter (Roland TB-303 / EMS VCS3 style).
 * Zero-delay feedback (ZDF) via a tridiagonal solve of the 4 stages.
 *
 * Ref: Zavalishin, "The Art of VA Filter Design" (2012), §5.10 (unbuffered/
 *      loaded ladder networks).
 *      Pirkle, "Designing Audio Effect Plugins in C++" (2019), Ch. 10.
 *
 * Unlike the Moog transistor ladder — 4 stages isolated by unity-gain buffers,
 * so each stage's output depends only on the stage before it — the diode
 * ladder has no buffers: neighboring stages load each other, so each stage's
 * drive depends on both its predecessor's output AND its successor's state.
 * This couples all 4 stages into one tridiagonal system, solved once per
 * sample (Thomas algorithm) instead of Moog's simple forward cascade. Each
 * stage also carries its own tanh nonlinearity (the diode's I–V curve),
 * closed by one global zero-delay resonance path around the whole chain.
 *
 * @module  audio-filter/analog/diode-ladder
 * @param {Float32Array|Float64Array} data - audio buffer (modified in place)
 * @param {Object} params
 * @param {number} [params.fc=1000] - cutoff frequency Hz
 * @param {number} [params.resonance=0] - resonance 0–1 (self-oscillation ≈1.15–1.2, higher than moog-ladder's 1 — the per-stage tanh damps more; see readme)
 * @param {number} [params.fs=44100] - sample rate
 * @param {number} [params.drive=1] - input drive (saturation amount)
 */

let {tan, tanh, PI, min} = Math

// Inter-stage loading: diode stages have no buffers, so a fraction of each
// neighbor's signal bleeds across the stage boundary (unlike moog-ladder's 0).
let C = 0.1

const SET = new Float64Array(4)   // a direct call's fc, resonance, drive, fs

export default function diodeLadder (data, params) {
	SET[0] = params.fc || 1000
	SET[1] = params.resonance != null ? params.resonance : 0
	SET[3] = params.fs || 44100
	SET[2] = params.drive ?? 1

	// State: 4 one-pole integrator states
	if (!params._s) params._s = new Float64Array(4)
	return diodeBlock(data, params._s, SET)
}

/**
 * One block in place, allocating nothing: `s` the 4 integrator states (a Float64Array kept from call to call), `set` a
 * Float64Array of fc, resonance, drive and fs
 */
export function diodeBlock (data, s, set) {
	let fc = set[0], res = set[1], drive = set[2], fs = set[3]

	// Trapezoidal integrator coefficient
	let g = tan(PI * min(fc, fs * 0.49) / fs)
	let G = g / (1 + g)
	let k = res * 4               // feedback coefficient, same convention as moog-ladder

	// Tridiagonal system for the 4 bidirectionally-coupled stages:
	//   (1+a)y1 - a*y2         = d1
	//   -G*y1 + (1+a)y2 - a*y3 = d2
	//   -G*y2 + (1+a)y3 - a*y4 = d3
	//   -G*y3 + y4             = d4
	// a = G*C couples each stage to its neighbor. Elimination coefficients
	// (Thomas algorithm) depend only on G, C — precomputed once per block.
	let a = G * C
	let den1 = 1 + a
	let cp1 = -a / den1
	let den2 = den1 + G * cp1
	let cp2 = -a / den2
	let den3 = den1 + G * cp2
	let cp3 = -a / den3
	let den4 = 1 + G * cp3

	// The solve of (d1..d4) -> [y1,y2,y3,y4], written out where it is used: forward sweep dp1..dp4, then
	// y4 = dp4, y3 = dp3 − cp3·y4, y2 = dp2 − cp2·y3, y1 = dp1 − cp1·y2. Used for the zero-delay estimate
	// (from old state, y4 alone) and the final post-feedback pass.

	// Sensitivity of y4 to a unit change in the post-feedback drive (constant per block): the solve of (G, 0, 0, 0)
	let e1 = G / den1
	let e2 = (0 + G * e1) / den2
	let e3 = (0 + G * e2) / den3
	let sens = (0 + G * e3) / den4

	for (let i = 0, n = data.length; i < n; i++) {
		let t0 = tanh(s[0]), t1 = tanh(s[1]), t2 = tanh(s[2]), t3 = tanh(s[3])
		let d0 = (1 - G) * t0, d1 = (1 - G) * t1, d2 = (1 - G) * t2, d3 = (1 - G) * t3

		// Zero-input estimate (S) of stage-4 output, from old state only
		let p1 = d0 / den1
		let p2 = (d1 + G * p1) / den2
		let p3 = (d2 + G * p2) / den3
		let S = (d3 + G * p3) / den4

		// Implicit feedback solve, then input drive/saturation
		let u = (data[i] - k * S) / (1 + k * sens)
		u = tanh(u * drive)

		// Final coupled solve with the resolved drive
		let q1 = (d0 + G * u) / den1
		let q2 = (d1 + G * q1) / den2
		let q3 = (d2 + G * q2) / den3
		let y4 = (d3 + G * q3) / den4
		let y3 = q3 - cp3 * y4
		let y2 = q2 - cp2 * y3
		let y1 = q1 - cp1 * y2
		s[0] = 2 * y1 - s[0]
		s[1] = 2 * y2 - s[1]
		s[2] = 2 * y3 - s[2]
		s[3] = 2 * y4 - s[3]

		data[i] = y4
	}

	return data
}
