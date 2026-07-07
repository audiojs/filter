import dfFilter from 'digital-filter/core/filter.js'
import matchedZ from 'digital-filter/core/matched-z.js'

export default function itu468(data, params = {}) {
	let fs = params.fs || 48000
	if (!params._sos || params._fs !== fs) {
		params._fs = fs
		params._sos = itu468.coefs(fs)
		params.coefs = params._sos
	}
	return dfFilter(data, params)
}

itu468.coefs = function coefs(fs = 48000) {
	// ITU-R BS.468-4 noise weighting, exact matched-z realization: peaked at
	// +12.2 dB near 6.3 kHz. Poles found via Durand-Kerner root-finding on the
	// spec's rational polynomial (Rec. ITU-R BS.468-4 Annex 1, reproduced in
	// Wikipedia "ITU-R 468 noise weighting"); the analog prototype matches the
	// spec table to within 0.05 dB across 31.5 Hz–20 kHz. Matched z reproduces
	// this near-exactly away from Nyquist; error grows above ~10 kHz at 44.1/48 kHz.
	return matchedZ(
		[
			{ re: -23615.535214, im: 36379.908937 },
			{ re: -23615.535214, im: -36379.908937 },
			{ re: -18743.746691, im: 62460.156453 },
			{ re: -18743.746691, im: -62460.156453 },
			-25903.701048,
			-62675.170058
		],
		[0],
		fs,
		1000
	)
}
