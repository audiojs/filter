# @audio/speech-formant [![npm](https://img.shields.io/npm/v/@audio/speech-formant)](https://www.npmjs.com/package/@audio/speech-formant) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Parallel formant filter bank

```
npm install @audio/speech-formant
```

```js
import formant from '@audio/speech-formant'
```

Parallel resonator bank — each peak models one vocal tract resonance (formant).

**Model**: parallel combination of second-order resonators, each modeling one vocal tract mode<br>
**Formant frequencies**: determined by vocal tract shape; F1 controls vowel openness, F2 controls front/back<br>
**Typical ranges**: F1: 250–850 Hz, F2: 850–2500 Hz, F3: 1700–3500 Hz<br>
**Implementation**: uses [`@audio/filter-resonator`](https://github.com/audiojs/filter/tree/main/packages/filter-resonator) internally — constant peak-gain bandpass per formant<br>
**Defaults**: F1=730 Hz (bw 90, gain 1), F2=1090 Hz (bw 110, gain 0.5), F3=2440 Hz (bw 170, gain 0.3) — open vowel /a/

```js
formant(excitation, { fs: 44100 })   // vowel /a/ (default)

formant(excitation, {
  formants: [{ fc: 270, bw: 60, gain: 1 }, { fc: 2290, bw: 90, gain: 0.5 }],
  fs: 44100
})   // vowel /i/
```

| Param | Default | |
|---|---|---|
| `formants` | 3-formant /a/ bank | array of `{ fc, bw?, gain? }` — `bw` default `50`, `gain` default `1` per band |
| `fs` | `44100` | sample rate, Hz |

Rebuilds the resonator bank only when a band's `fc`/`bw`/`gain` or `fs` actually changes (keyed by content, not object identity) — safe to reuse or mutate the same `formants` array across calls.

**Use when:** speech synthesis, singing synthesis, vocal effects, acoustic phonetics.

**Not a substitute for:** LPC synthesis, which estimates formants automatically from a speech signal.

---

Part of [@audio/filter](https://github.com/audiojs/filter) — the filter family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
