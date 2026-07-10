// @audio/filter — audio-facing filters umbrella re-exporting every @audio/filter-* atom.
// For smaller bundles, depend directly on the individual atom.
// Weighting → @audio/weighting, auditory banks → @audio/auditory, EQ → @audio/eq,
// crossfeed → @audio/spatial-crossfeed, speech atoms → @audio/speech-* (in this repo).

export { highpass, lowpass, bandpass, notch, allpass } from '@audio/filter-biquad'
export { default as comb } from '@audio/filter-comb'
export { default as dcBlocker } from '@audio/filter-dcblocker'
export { default as resonator } from '@audio/filter-resonator'
export { default as variableBandwidth } from '@audio/filter-variable'
export { emphasis, deemphasis } from '@audio/filter-preemphasis'
export { derivative, integral } from '@audio/filter-derivative'
export { default as spectralTilt } from '@audio/filter-spectral-tilt'
export { default as moogLadder } from '@audio/filter-moog-ladder'
export { default as diodeLadder } from '@audio/filter-diode-ladder'
export { default as korg35 } from '@audio/filter-korg35'
export { default as oberheim } from '@audio/filter-oberheim'
