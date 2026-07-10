// @audio/filter-derivative — FFmpeg aderivative/aintegral first-difference & running-sum pair.
// Kernel tests cite libavfilter/af_aderivative.c; the manifest smoke test drives audio.js
// directly with a stub ctx to catch host-wiring bugs before the engine ever hosts it.
import test, { almost, ok } from 'tst'
import { derivative, integral } from '@audio/filter-derivative'
import { derivative as derivativeAtom, integral as integralAtom } from '@audio/filter-derivative/audio'
import { dftMag } from './util.js'

const fs = 44100

function sine (f, n) {
	let d = new Float64Array(n)
	for (let i = 0; i < n; i++) d[i] = Math.sin(2 * Math.PI * f * i / fs)
	return d
}
function maxDiff (a, b) {
	let m = 0
	for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]))
	return m
}

test('derivative — ramp k*i is constant k after the first sample', () => {
	// af_aderivative.c DERIVATIVE: dst[n] = src[n] - prv[0]; prv[0] = src[n]
	// prv[0] starts at 0, so sample 0 sees a phantom x[-1]=0 boundary; from n=1 on, y[n] = k
	let k = 3.5, n = 100
	let x = new Float64Array(n)
	for (let i = 0; i < n; i++) x[i] = k * i
	derivative(x, {})
	for (let i = 1; i < n; i++) almost(x[i], k, 1e-9, `sample ${i}`)
})

test('integral(derivative(x)) reconstructs x exactly at leak=1', () => {
	// running sum of first differences telescopes: sum_{k=0..n}(x[k]-x[k-1]) = x[n] (x[-1]=0)
	let x = sine(440, 2048)
	let round = Float64Array.from(x)
	derivative(round, {})
	integral(round, { leak: 1 })
	ok(maxDiff(round, x) < 1e-9, 'round trip reconstructs input')
})

test('derivative — sine first-difference amplitude = 2*sin(pi*f/sr) ±1%', () => {
	// x[n]=sin(wn), x[n]-x[n-1] = 2 sin(w/2) cos(wn - w/2), w = 2*pi*f/sr → amplitude 2*sin(pi*f/sr)
	let f = 1000, n = 8192
	let x = sine(f, n)
	let orig = dftMag(x, f, fs)
	let d = Float64Array.from(x)
	derivative(d, {})
	let diffMag = dftMag(d, f, fs)
	let expected = 2 * Math.sin(Math.PI * f / fs)
	almost(diffMag / orig, expected, expected * 0.01, 'within 1%')
})

test('derivative — chunked calls ≡ one whole-buffer call (state continuity)', () => {
	let x = sine(300, 4000)
	let whole = Float64Array.from(x)
	derivative(whole, {})

	let chunked = Float64Array.from(x)
	let p = {}
	let sizes = [777, 1500, chunked.length - 777 - 1500]  // 3 uneven chunks
	let pos = 0
	for (let size of sizes) { derivative(chunked.subarray(pos, pos + size), p); pos += size }

	ok(maxDiff(whole, chunked) === 0, 'bit-identical across chunk boundaries')
})

test('integral — leak=0.99 on DC converges to 1/(1-leak)=100, stays finite', () => {
	// geometric series bound: acc_n = sum_{k=0}^n leak^k → 1/(1-leak) as n→∞
	let n = 5000
	let x = new Float64Array(n).fill(1)
	integral(x, { leak: 0.99 })
	let bound = 1 / (1 - 0.99)
	almost(x[n - 1], bound, bound * 0.01, 'converged within 1%')
	ok(Number.isFinite(x[n - 1]), 'stays finite')
})

test('audio.js manifest — atoms match kernel output across two blocks (stub ctx)', () => {
	// everything in Float32 (the manifest's own working precision) so the comparison
	// against the kernel run isn't polluted by a float64-vs-float32 rounding mismatch
	let ctx = { sampleRate: 44100, maxChannels: 2 }
	let x = Float32Array.from(sine(500, 512))
	let half = 256

	// derivative atom — no params
	let procD = derivativeAtom(ctx)
	let outD1 = [new Float32Array(half)], outD2 = [new Float32Array(half)]
	procD([[x.subarray(0, half)]], [outD1], {})
	procD([[x.subarray(half)]], [outD2], {})
	let manifestD = new Float32Array(x.length)
	manifestD.set(outD1[0], 0)
	manifestD.set(outD2[0], half)

	let refD = Float32Array.from(x)
	derivative(refD, {})
	ok(maxDiff(manifestD, refD) === 0, 'derivative manifest continuity matches kernel')

	// integral atom — leak param
	let procI = integralAtom(ctx)
	let outI1 = [new Float32Array(half)], outI2 = [new Float32Array(half)]
	procI([[x.subarray(0, half)]], [outI1], { leak: [1] })
	procI([[x.subarray(half)]], [outI2], { leak: [1] })
	let manifestI = new Float32Array(x.length)
	manifestI.set(outI1[0], 0)
	manifestI.set(outI2[0], half)

	let refI = Float32Array.from(x)
	integral(refI, { leak: 1 })
	ok(maxDiff(manifestI, refI) === 0, 'integral manifest continuity matches kernel')
})
