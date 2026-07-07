import dfFilter from 'digital-filter/core/filter.js'

export default function kWeighting(data, params = {}) {
	let fs = params.fs || 48000
	if (!params._sos || params._fs !== fs) {
		params._fs = fs
		params._sos = kWeighting.coefs(fs)
		params.coefs = params._sos
	}
	return dfFilter(data, params)
}

kWeighting.coefs = function coefs(fs = 48000) {
	// ITU-R BS.1770-4 K-weighting: high-shelf + RLB highpass.
	// Redesigned per sample rate from the canonical analog prototype constants
	// (De Man 2014, "Evaluation of Implementations of the ITU-R BS.1770 Loudness
	// Algorithm"; same as pyloudnorm). At fs=48000 this reproduces the spec's
	// coefficient table to ~1e-11. NB the RLB highpass uses Q≈0.5003, not the
	// shelf's 0.7072, and its b-coefficients stay unnormalized {1,-2,1} per spec.

	// Stage 1: spherical-head high shelf
	let G = 3.999843853973347, Qs = 0.7071752369554196, fc = 1681.974450955533
	let K = Math.tan(Math.PI * fc / fs)
	let Vh = Math.pow(10, G / 20)
	let Vb = Math.pow(Vh, 0.4996667741545416)
	let a0 = 1 + K / Qs + K * K
	let shelf = {
		b0: (Vh + Vb * K / Qs + K * K) / a0,
		b1: 2 * (K * K - Vh) / a0,
		b2: (Vh - Vb * K / Qs + K * K) / a0,
		a1: 2 * (K * K - 1) / a0,
		a2: (1 - K / Qs + K * K) / a0
	}

	// Stage 2: RLB weighting highpass
	let Qh = 0.5003270373238773, fh = 38.13547087602444
	let Kh = Math.tan(Math.PI * fh / fs)
	let d0 = 1 + Kh / Qh + Kh * Kh
	let rlb = {
		b0: 1, b1: -2, b2: 1,
		a1: 2 * (Kh * Kh - 1) / d0,
		a2: (1 - Kh / Qh + Kh * Kh) / d0
	}

	return [shelf, rlb]
}
