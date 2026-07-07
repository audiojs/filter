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

export default function diodeLadder (data, params) {
	let fc = params.fc || 1000
	let res = params.resonance != null ? params.resonance : 0
	let fs = params.fs || 44100
	let drive = params.drive ?? 1

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

	// solve(d1..d4) -> [y1,y2,y3,y4]; reused for both the zero-delay estimate
	// (from old state) and the final post-feedback pass.
	let out = new Float64Array(4)
	function solve (d1, d2, d3, d4) {
		let dp1 = d1 / den1
		let dp2 = (d2 + G * dp1) / den2
		let dp3 = (d3 + G * dp2) / den3
		let dp4 = (d4 + G * dp3) / den4
		out[3] = dp4
		out[2] = dp3 - cp3 * out[3]
		out[1] = dp2 - cp2 * out[2]
		out[0] = dp1 - cp1 * out[1]
		return out
	}

	// Sensitivity of y4 to a unit change in the post-feedback drive (constant per block)
	let sens = solve(G, 0, 0, 0)[3]

	// State: 4 one-pole integrator states
	if (!params._s) params._s = new Float64Array(4)
	let s = params._s

	for (let i = 0, n = data.length; i < n; i++) {
		let t0 = tanh(s[0]), t1 = tanh(s[1]), t2 = tanh(s[2]), t3 = tanh(s[3])
		let d0 = (1 - G) * t0, d1 = (1 - G) * t1, d2 = (1 - G) * t2, d3 = (1 - G) * t3

		// Zero-input estimate (S) of stage-4 output, from old state only
		let S = solve(d0, d1, d2, d3)[3]

		// Implicit feedback solve, then input drive/saturation
		let u = (data[i] - k * S) / (1 + k * sens)
		u = tanh(u * drive)

		// Final coupled solve with the resolved drive
		let y = solve(d0 + G * u, d1, d2, d3)
		for (let j = 0; j < 4; j++) s[j] = 2 * y[j] - s[j]

		data[i] = y[3]
	}

	return data
}
