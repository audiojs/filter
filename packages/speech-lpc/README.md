# @audio/speech-lpc [![npm](https://img.shields.io/npm/v/@audio/speech-lpc)](https://www.npmjs.com/package/@audio/speech-lpc) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Linear Predictive Coding analysis/synthesis

```
npm install @audio/speech-lpc
```

```js
import { lpcAnalysis, lpcSynthesize } from '@audio/speech-lpc'
```

Linear Predictive Coding — estimates the vocal tract transfer function from a speech signal.

**Analysis**: autocorrelation method + Levinson-Durbin recursion (via [`@audio/lpc`](https://github.com/audiojs/lpc)) → LPC coefficients + residual<br>
**Synthesis**: all-pole filter reconstructs signal from residual excitation<br>
**Round-trip**: `lpcAnalysis` → `lpcSynthesize` recovers the original signal exactly

```js
// Analysis: extract vocal tract model
let { coefs, gain, residual } = lpcAnalysis(speechFrame, { order: 12 })

// Synthesis: reconstruct from residual
lpcSynthesize(residual, { coefs, gain })   // residual → reconstructed speech

// Modify pitch: replace residual with different excitation
let buzz = generatePulseTrainAtNewPitch()
lpcSynthesize(buzz, { coefs, gain })       // speech at new pitch
```

| Function | Param | Default | |
|---|---|---|---|
| `lpcAnalysis` | `order` | `12` | LPC order |
| `lpcSynthesize` | `coefs` | — | required, `Float64Array`/`number[]` from `lpcAnalysis` |
| | `gain` | `1` | excitation scale |

`lpcAnalysis` returns `{ coefs, gain, residual }`: `coefs` is `a[1..order]` of $A(z) = 1 + \sum a_k z^{-k}$; `gain` is the per-sample prediction-error std; `residual` is the whitening-filter output normalized to unit power — feed it straight to `lpcSynthesize`, or replace it with a different excitation (pulse train, noise) to resynthesize at a new pitch.

`lpcSynthesize` keeps its all-pole state (`params._s`) on the `params` object — pass the same object across chunks to continue the synthesis filter state.

**Origin**: Atal & Hanauer, "Speech Analysis and Synthesis by Linear Prediction of the Speech Wave" (1971); foundation of CELP, GSM, and modern speech codecs.

**Use when:** speech coding, pitch modification, voice conversion, formant estimation, speech analysis.

---

Part of [@audio/filter](https://github.com/audiojs/filter) — the filter family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
