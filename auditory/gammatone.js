/**
 * Gammatone auditory filter (cochlear model).
 * Cascade of complex one-pole filters (4th-order by default).
 */

let { cos, sin, exp, PI } = Math

/**
 * Apply gammatone filter in-place.
 * @param {Float32Array|Float64Array|Array<number>} data - Input/output buffer, filtered in-place
 * @param {object} params - { fc: 1000, fs: 44100, order: 4 }, plus persisted `_`-prefixed cache/state
 * @param {number} params.fc - Center frequency in Hz (default 1000)
 * @param {number} params.fs - Sample rate in Hz (default 44100)
 * @param {number} params.order - Cascade order, i.e. number of one-pole stages (default 4)
 * @returns {Float32Array|Float64Array|Array<number>} data, filtered in-place
 */
export default function gammatone (data, params) {
	let fc = params.fc || 1000
	let fs = params.fs || 44100
	let order = params.order || 4

	// ERB bandwidth
	let erb = 24.7 * (4.37 * fc / 1000 + 1)
	let b = 2 * PI * 1.019 * erb

	let T = 1 / fs
	let w = 2 * PI * fc * T
	let a = exp(-b * T)
	let cosW = a * cos(w), sinW = a * sin(w)

	// Gain normalization: compute frequency-domain peak (at fc) from a test impulse,
	// then scale so the filter has 0 dB at its center frequency.
	let gain = 1
	if (params._gain == null || params._fc !== fc || params._order !== order || params._fs !== fs) {
		let ts = new Float64Array(order * 2)
		let irLen = Math.max(4096, Math.round(fs / erb * 10)) // enough cycles to capture the ringing
		// Sum impulse response at center frequency (= DFT at fc = sum of h[n]*e^(-j*w*n))
		let re = 0, im = 0
		for (let i = 0; i < irLen; i++) {
			let v = i === 0 ? 1 : 0
			for (let j = 0; j < order; j++) {
				let sre = ts[j*2], sim = ts[j*2+1]
				ts[j*2] = cosW * sre - sinW * sim + v
				ts[j*2+1] = sinW * sre + cosW * sim
				v = ts[j*2]
			}
			let phase = w * i
			re += v * cos(phase)
			im -= v * sin(phase)
		}
		let mag = Math.sqrt(re * re + im * im)
		params._gain = mag > 0 ? 1 / mag : 1
		params._fc = fc; params._order = order; params._fs = fs
	}
	gain = params._gain

	if (!params._s || params._s.length !== order * 2) params._s = new Float64Array(order * 2)
	let s = params._s

	for (let i = 0, n = data.length; i < n; i++) {
		let x = data[i] * gain

		for (let j = 0; j < order; j++) {
			let re = s[j * 2], im = s[j * 2 + 1]
			let newRe = cosW * re - sinW * im + x
			let newIm = sinW * re + cosW * im
			s[j * 2] = newRe
			s[j * 2 + 1] = newIm
			x = newRe
		}

		data[i] = x
	}

	return data
}
