# @audio/speech-vocoder [![npm](https://img.shields.io/npm/v/@audio/speech-vocoder)](https://www.npmjs.com/package/@audio/speech-vocoder) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Channel vocoder

```
npm install @audio/speech-vocoder
```

```js
import vocoder from '@audio/speech-vocoder'
```

Channel vocoder — transfers the spectral envelope of one sound onto the pitched content of another.

Note: takes two separate buffers, always returns a new `Float64Array` (does not modify either input in-place).

**Principle**: analyze modulator into N log-spaced bandpass bands → extract envelope per band (asymmetric attack/release follower) → multiply with the same-band-filtered carrier → sum<br>
**Implementation**: N parallel RBJ bandpass filters (Q=5, fixed) on both signals; envelope follower per modulator band (5 ms attack, 50 ms release)<br>
**Band count**: 8 = robotic effect; 16 (default) = classic vocoder sound; 32+ = more speech intelligibility

```js
// carrier: pitched source (sawtooth, buzz, noise...)
// modulator: signal whose spectral shape to impose (voice, instrument...)
let output = vocoder(carrier, modulator, { bands: 16, fs: 44100 })
```

| Param | Default | |
|---|---|---|
| `bands` | `16` | number of analysis/synthesis bands, log-spaced between `fmin` and `fmax` |
| `fmin` | `100` | lowest band center, Hz |
| `fmax` | `8000` | highest band center, Hz |
| `fs` | `44100` | sample rate, Hz |

Rebuilds the filter bank only when `bands`/`fmin`/`fmax`/`fs` actually change — safe to reuse the same `params` object across calls to carry filter and envelope state forward.

**Inventor**: Homer Dudley (1939), Bell Labs.

**Use when:** voice effects, talkbox simulation, cross-synthesis, spectral morphing.

---

Part of [@audio/filter](https://github.com/audiojs/filter) — the filter family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
