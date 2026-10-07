#!/usr/bin/env node
/**
 * Generate SVG plots for @audio/filter's documentation.
 * Run: node plot/generate.js
 */
import { plotFilter, plotFir, plotCompare, theme } from 'digital-filter/plot'
import * as filters from '../index.js'
import formant from '../packages/speech-formant/formant.js'
import { lpcAnalysis, lpcSynthesize } from '../packages/speech-lpc/lpc.js'
import { writeFileSync } from 'node:fs'

// this repo's filters; weighting, auditory banks and EQ plot in their own repos
const af = { ...filters, formant, lpcAnalysis, lpcSynthesize }

let FS = theme.fs

function write (name, svg) { writeFileSync(`plot/${name}.svg`, svg) }

function impulse (fn, params, n = 2048, slice = 512) {
	let data = new Float64Array(n); data[0] = 1
	fn(data, params)
	return data.slice(0, slice)
}

// ── Analog ──

{
	let resonances = [0, 0.25, 0.5, 0.75, 0.95]
	write('moog-ladder', plotCompare(
		resonances.map(r => [`res=${r}`, impulse(af.moogLadder, {fc: 1000, resonance: r, fs: FS}, 4096, 2048)]),
		'Moog ladder fc=1kHz (resonance sweep)'
	))
	let modes = [['LP24', 'lowpass', 4], ['HP24', 'highpass', 4], ['BP24', 'bandpass', 4], ['LP12', 'lowpass', 2], ['HP12', 'highpass', 2], ['BP12', 'bandpass', 2]]
	write('moog-ladder-modes', plotCompare(
		modes.map(([name, type, poles]) => [name, impulse(af.moogLadder, {fc: 1000, resonance: 0.5, fs: FS, type, poles})]),
		'Moog ladder fc=1kHz, resonance=0.5 (modes)'
	))
}

write('diode-ladder', plotFir(impulse(af.diodeLadder, {fc: 1000, resonance: 0.5, fs: FS}), 'Diode ladder fc=1kHz, resonance=0.5'))

write('korg35', plotCompare([
	['LP', impulse(af.korg35, {fc: 1000, resonance: 0.3, type: 'lowpass',  fs: FS})],
	['HP', impulse(af.korg35, {fc: 1000, resonance: 0.3, type: 'highpass', fs: FS})],
], 'Korg35 fc=1kHz, resonance=0.3'))

// ── Analog (cont.) ──

write('oberheim', plotCompare([
	['LP', impulse(af.oberheim, {fc: 1000, resonance: 0.5, type: 'lowpass',  fs: FS})],
	['HP', impulse(af.oberheim, {fc: 1000, resonance: 0.5, type: 'highpass', fs: FS})],
	['BP', impulse(af.oberheim, {fc: 1000, resonance: 0.5, type: 'bandpass', fs: FS})],
	['Notch', impulse(af.oberheim, {fc: 1000, resonance: 0.5, type: 'notch', fs: FS})],
], 'Oberheim SEM fc=1kHz, resonance=0.5'))

// ── Speech ──

write('formant', plotFir(impulse(af.formant, {fs: FS}), 'Formant filter (vowel /a/)'))

{
	let N = 512
	let data = new Float64Array(N)
	let seed = 42
	for (let i = 0; i < N; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; data[i] = i > 0 ? 0.3 * ((seed/0x7fffffff)*2-1) + 0.7 * data[i-1] : 0 }
	let orig = Float64Array.from(data)
	let { coefs, gain, residual } = af.lpcAnalysis(data, { order: 10 })
	let synth = Float64Array.from(residual)
	af.lpcSynthesize(synth, { coefs, gain })
	write('lpc', plotCompare([
		['Original', orig.slice(0, 256)],
		['Residual', residual.slice(0, 256)],
		['Synthesized', synth.slice(0, 256)],
	], 'LPC analysis/synthesis (order 10)'))
}

// ── Effect ──

write('dc-blocker',        plotFir(impulse(af.dcBlocker,        {R: 0.995}),                              'DC blocker R=0.995'))
write('comb',              plotFir(impulse(af.comb,             {delay: 22, gain: 0.5}),                  'Comb feedforward, delay=22'))
write('allpass',           plotFir(impulse(af.allpass.second,   {fc: 1000, Q: 1, fs: FS}),                'Allpass 2nd order fc=1kHz'))
write('emphasis',          plotFir(impulse(af.emphasis,         {alpha: 0.97}),                           'Pre-emphasis α=0.97'))
write('deemphasis',        plotFir(impulse(af.deemphasis,       {alpha: 0.97}),                           'De-emphasis α=0.97'))
write('lowpass',           plotFir(impulse(af.lowpass,          {fc: 1000, fs: FS}),                      'Lowpass fc=1kHz'))
write('highpass',          plotFir(impulse(af.highpass,         {fc: 1000, fs: FS}),                      'Highpass fc=1kHz'))
write('bandpass',          plotFir(impulse(af.bandpass,         {fc: 1000, Q: 2, fs: FS}),                'Bandpass fc=1kHz, Q=2'))
write('notch',             plotFir(impulse(af.notch,            {fc: 1000, Q: 10, fs: FS}),               'Notch fc=1kHz, Q=10'))
write('resonator',         plotFir(impulse(af.resonator,        {fc: 1000, bw: 50, fs: FS}),              'Resonator fc=1kHz, bw=50Hz'))
write('spectral-tilt',     plotFir(impulse(af.spectralTilt,     {slope: -3, fs: FS}),                     'Spectral tilt −3 dB/oct'))
write('variable-bandwidth',plotFir(impulse(af.variableBandwidth,{fc: 1000, Q: 1, fs: FS}),                'Variable bandwidth lowpass fc=1kHz'))

console.log('SVGs generated in plot/')
