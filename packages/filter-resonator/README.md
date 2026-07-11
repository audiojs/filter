# @audio/filter-resonator [![npm](https://img.shields.io/npm/v/@audio/filter-resonator)](https://www.npmjs.com/package/@audio/filter-resonator) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Constant-peak-gain resonator (JOS two-zero form)

```
npm install @audio/filter-resonator
```

```js
import resonator from '@audio/filter-resonator'
```

Constant peak-gain bandpass — peak amplitude stays fixed regardless of bandwidth.

$H(z) = \dfrac{\frac{1-R^2}{2}(1 - z^{-2})}{1 - 2R\cos(\omega_0)z^{-1} + R^2 z^{-2}}$

**Pole radius**: $R = e^{-\pi \cdot bw / f_s}$ — controls bandwidth; $bw \to 0$ gives infinite Q<br>
**Peak gain**: always 0 dB by construction — the two zeros at $z = \pm 1$ shape the numerator so $(1-R^2)/2$ normalizes the pole peak regardless of `fc`/`bw` (verified ±0.01 dB across `fc` ∈ {50, 440, 5000, 15000} Hz, `bw` ∈ {5, 20, 200} Hz)<br>
**Origin**: Julius O. Smith III, *Introduction to Digital Filters with Audio Applications* — Two-Pole, "Constant Peak-Gain Resonator"

```js
resonator(buffer, { fc: 440, bw: 20, fs: 44100 })
```

| Param | Default | |
|---|---|---|
| `fc` | — | required, center frequency Hz |
| `fs` | `44100` | sample rate, Hz |
| `bw` | `50` | bandwidth, Hz — smaller = higher Q |

Pass the same `params` object on every call to persist the two-pole state across blocks. Internal cache fields are prefixed `_r*` (`_rFc`, `_rA1`, …) so `params` can double as a caller-owned object — e.g. `@audio/speech-formant` shares one params object per formant band.

**Use when:** additive synthesis (bells, gongs), modal synthesis, formant bank building.

**vs Peaking EQ**: resonator has fixed 0 dB peak; peaking EQ has variable gain — use resonator for synthesis, EQ for mixing.

---

Part of [@audio/filter](https://github.com/audiojs/filter) — the filter family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
