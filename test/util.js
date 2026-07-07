export let EPSILON = 1e-10
export let LOOSE = 1e-4

// Compute DFT magnitude at a specific frequency
export function dftMag(data, f, fs) {
	let w = 2 * Math.PI * f / fs
	let re = 0, im = 0
	for (let n = 0; n < data.length; n++) {
		re += data[n] * Math.cos(w * n)
		im -= data[n] * Math.sin(w * n)
	}
	return Math.sqrt(re * re + im * im)
}

// Evaluate SOS filter magnitude in dB at exact frequency f Hz
export function magDB(sos, f, fs) {
	let w = 2 * Math.PI * f / fs
	let magSq = 1
	for (let c of sos) {
		let br = c.b0 + c.b1 * Math.cos(w)   + c.b2 * Math.cos(2*w)
		let bi =      -(c.b1 * Math.sin(w)   + c.b2 * Math.sin(2*w))
		let ar = 1   + c.a1 * Math.cos(w)   + c.a2 * Math.cos(2*w)
		let ai =      -(c.a1 * Math.sin(w)   + c.a2 * Math.sin(2*w))
		magSq *= (br*br + bi*bi) / (ar*ar + ai*ai)
	}
	return 10 * Math.log10(magSq)
}

export function impulse (n) {
	let d = new Float64Array(n || 64)
	d[0] = 1
	return d
}

export function dc (n, val) {
	let d = new Float64Array(n || 64)
	d.fill(val || 1)
	return d
}
