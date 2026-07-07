/**
 * Executes every ```js fence in readme.md to prove the documentation is real
 * runnable code, not just prose. Extracts fences, rewrites `audio-filter/...`
 * import specifiers to local paths (`digital-filter` imports resolve via
 * node_modules unchanged), and runs each fence as its own file so state never
 * leaks between examples — module singletons inside audio-filter/digital-filter
 * (eg lowpass.js's `useButterworth` registration) are still shared across
 * fences, same as they would be in a real app.
 *
 * Fences intentionally left non-runnable — API-shape fragments, and the
 * Pitfalls section's "Wrong" contrastive snippets — are marked in readme.md
 * with an info string of `js skip` and only counted, never executed.
 *
 * Prelude (stand-in data for readme snippets that reference audio the reader
 * is assumed to already have, eg `buffer`, `stream`): every runnable fence is
 * prefixed with the PRELUDE source below, which declares all of:
 *   buffer, signal, input, left, right          Float64Array(256), generic audio
 *   carrier, modulator                          Float64Array(1024), for vocoder
 *   phonoSignal, excitation                     Float64Array, RIAA/formant inputs
 *   speechFrame                                 Float64Array(512), for LPC
 *   stream, stereoStream                        arrays of a few buffers/pairs
 *   spectrum                                    [] (supports .push)
 *   rms(buf), lfo(), generatePulseTrainAtNewPitch()
 * A fence only pulls in the names it actually references (free variables);
 * unused prelude bindings are harmless.
 *
 * @module  audio-filter/test/readme
 */

import test from 'tst'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { fileURLToPath, pathToFileURL } from 'url'
import path from 'path'

let __dirname = path.dirname(fileURLToPath(import.meta.url))
let ROOT = path.resolve(__dirname, '..')
let TMP = path.join(__dirname, '.readme-tmp')

let PRELUDE = `
function mkBuf (n, scale, rich) {
	let b = new Float64Array(n)
	for (let i = 0; i < n; i++) b[i] = (scale ?? 0.5) * (Math.sin(i * 0.3) + (rich ? Math.sin(i * 0.07) * 0.5 : 0) + (Math.random() - 0.5) * 0.05)
	return b
}
const buffer = mkBuf(256)
const signal = mkBuf(256)
const input = mkBuf(256)
const left = mkBuf(256)
const right = mkBuf(256, 0.4)
const carrier = mkBuf(1024, 0.9)
const modulator = mkBuf(1024, 0.4)
const phonoSignal = mkBuf(256)
const speechFrame = mkBuf(512, 0.8, true)
const excitation = mkBuf(64)
const spectrum = []
const rms = buf => Math.sqrt(Array.from(buf).reduce((s, x) => s + x * x, 0) / buf.length)
let _lfoPhase = 0
const lfo = () => Math.sin(_lfoPhase += 0.3)
const generatePulseTrainAtNewPitch = () => { let b = new Float64Array(64); for (let i = 0; i < b.length; i += 16) b[i] = 1; return b }
const stream = [mkBuf(128), mkBuf(128), mkBuf(128)]
const stereoStream = [[mkBuf(128), mkBuf(128)], [mkBuf(128), mkBuf(128)], [mkBuf(128), mkBuf(128)]]
`

// Rewrite 'audio-filter[/domain[/file.js]]' specifiers to absolute paths under ROOT;
// leave 'digital-filter...' (and anything else) untouched — it resolves via node_modules.
function rewriteImports (src) {
	return src.replace(/from '(audio-filter)((?:\/[^'"\n]*)?)'/g, (_, pkg, sub) => {
		let target = !sub ? `${ROOT}/index.js`
			: sub.endsWith('.js') ? `${ROOT}${sub}`
			: `${ROOT}${sub}/index.js`
		return `from '${target}'`
	})
}

function extractFences (md) {
	let re = /```([^\n]*)\n([\s\S]*?)```/g
	let fences = [], m
	while ((m = re.exec(md))) {
		let info = m[1].trim()
		if (!info.startsWith('js')) continue
		let line = md.slice(0, m.index).split('\n').length
		fences.push({ line, skip: info === 'js skip', body: m[2] })
	}
	return fences
}

let md = readFileSync(path.join(ROOT, 'readme.md'), 'utf8')
let fences = extractFences(md)

mkdirSync(TMP, { recursive: true })

let ran = 0, skipped = 0
fences.forEach((fence, i) => {
	let name = `readme.md fence ${i + 1} (line ${fence.line})`
	if (fence.skip) {
		skipped++
		test.skip(name, () => {})
		return
	}
	ran++
	let file = path.join(TMP, `fence-${i + 1}.mjs`)
	test(name, async () => {
		writeFileSync(file, PRELUDE + '\n' + rewriteImports(fence.body))
		try {
			await import(pathToFileURL(file).href)
		} finally {
			rmSync(file, { force: true })
		}
	})
})

console.log(`readme.md: ${fences.length} js fences — ${ran} run, ${skipped} skipped`)

process.on('exit', () => rmSync(TMP, { recursive: true, force: true }))
