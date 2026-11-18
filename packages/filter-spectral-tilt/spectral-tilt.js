/**
 * Spectral tilt filter: apply a constant dB/octave slope to the spectrum.
 * Implemented as a cascade of first-order shelving sections.
 *
 * @module  audio-filter/effect/spectral-tilt
 */

const STAGES = 8   // octave-spaced from 62.5 Hz: 62.5, 125, 250, ... 8 kHz, those under fs/2

/**
 * @param {Float64Array} data - Input (modified in-place)
 * @param {object} params - { slope: dB per octave (positive = boost high), fs }
 */
export default function spectralTilt (data, params) {
	let slope = params.slope || 0  // dB/octave
	let fs = params.fs || 44100

	if (slope === 0) return data

	if (!params._c || params._slope !== slope || params._fs !== fs) {
		params._slope = slope
		params._fs = fs
		if (!params._s) params._s = new Float64Array(STAGES)
		params._c = tiltCoefs(slope, fs, params._c)
	}

	return tiltBlock(data, params._s, params._c)
}

/**
 * The cascade for `slope` dB/octave at fs, written into `c` (a Float64Array of 2 + 8) and returned: c[0] the stages,
 * one an octave from 62.5 Hz while under fs/2; c[1] the gain each applies above its corner; c[2…] their poles
 */
export function tiltCoefs (slope, fs, c = new Float64Array(2 + STAGES)) {
	let n = 0
	for (let j = 0; j < STAGES; j++) {
		let fc = 62.5 * Math.pow(2, j)
		if (fc >= fs / 2) continue
		c[2 + n++] = Math.exp(-2 * Math.PI * fc / fs)
	}
	c[0] = n
	c[1] = Math.pow(10, slope / 20)  // gain per octave
	return c
}

/**
 * One block in place, allocating nothing: `s` a Float64Array of the stages' states (kept from call to call), `c` the
 * cascade tiltCoefs writes. A stage is the one-pole s = a·s + (1 − a)·x and the shelf s + (x − s)·gain; `gains`, when
 * given, the gain each frame in place of c[1] (the slope moves no pole, only this gain)
 */
export function tiltBlock (data, s, c, gains) {
	let n = c[0], gain = c[1], G = gains !== undefined
	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i], g = G ? gains[i] : gain
		for (let j = 0; j < n; j++) {
			let a = c[2 + j]
			s[j] = a * s[j] + (1 - a) * x
			x = s[j] + (x - s[j]) * g
		}
		data[i] = x
	}
	return data
}

/**
 * At slope 0 the stages are the identity: the input passes as it is, and each stage's one-pole follows it here, so that
 * a slope moving off 0 starts from the states the cascade has there, not from where they were left
 */
export function tiltIdle (data, s, c) {
	let n = c[0]
	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		for (let j = 0; j < n; j++) { let a = c[2 + j]; s[j] = a * s[j] + (1 - a) * x }
	}
	return data
}
