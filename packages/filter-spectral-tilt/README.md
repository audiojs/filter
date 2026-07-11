# @audio/filter-spectral-tilt [![npm](https://img.shields.io/npm/v/@audio/filter-spectral-tilt)](https://www.npmjs.com/package/@audio/filter-spectral-tilt) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Spectral tilt filter: apply a constant dB/octave slope to the spectrum

```
npm install @audio/filter-spectral-tilt
```

```js
import spectralTilt from '@audio/filter-spectral-tilt'
```

Applies a constant dB/octave slope — tilts the entire spectrum.

**Model**: cascade of 8 octave-spaced first-order shelving sections approximating a fractional power-law spectrum $S(f) \propto f^\alpha$; positive slope boosts highs, negative slope cuts them<br>
**slope**: $\alpha = -3\,\text{dB/oct}$ gives pink noise character; $-6\,\text{dB/oct}$ gives brownian/red noise<br>
**Accuracy**: measured slope tracks the requested dB/oct to within ~20% (inherent to the 8-stage shelving cascade) — e.g. `slope: +3` measures ≈+2.4 dB/oct, `slope: -6` measures ≈-4.9 dB/oct

```js
spectralTilt(buffer, { slope: -3, fs: 44100 })   // −3 dB/oct: pink noise character
spectralTilt(buffer, { slope: +3, fs: 44100 })   // +3 dB/oct: pre-emphasis for coding
```

| Param | Default | |
|---|---|---|
| `slope` | `0` | dB/octave; `0` is a no-op (returns `data` unmodified) |
| `fs` | `44100` | sample rate, Hz |

Pass the same `params` object on every call to persist the 8-section cascade state across blocks.

**Use when:** matching microphone/speaker frequency responses, spectral coloring, noise synthesis.

---

Part of [@audio/filter](https://github.com/audiojs/filter) — the filter family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
