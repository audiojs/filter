# @audio/filter-variable [![npm](https://img.shields.io/npm/v/@audio/filter-variable)](https://www.npmjs.com/package/@audio/filter-variable) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Variable-bandwidth filter with per-sample smoothed coefficient trajectory

```
npm install @audio/filter-variable
```

```js
import variableBandwidth from '@audio/filter-variable'
```

Lowpass with continuously variable bandwidth — smooth parameter automation without discontinuities.

**Implementation**: `fc`/`Q` are exponentially smoothed toward their target values with a 5 ms time constant, and biquad coefficients are recomputed from the smoothed values every sample (not once per buffer)<br>
**Property**: no discontinuity when $f_c$ or $Q$ change — a mid-buffer step change lands ~9x closer to the plain-lowpass baseline than an abrupt coefficient jump; once converged, steady-state output equals plain lowpass/highpass/bandpass

```js
variableBandwidth(buffer, { fc: 2000, Q: 1.0, fs: 44100 })
```

| Param | Default | |
|---|---|---|
| `fc` | `1000` | target cutoff/center frequency, Hz |
| `Q` | `0.707` | target quality factor |
| `fs` | `44100` | sample rate, Hz |
| `type` | `'lowpass'` | `'lowpass'`, `'highpass'`, or `'bandpass'` |

Pass the same `params` object on every call — mutate `params.fc`/`params.Q` in place between calls; the smoothing state and biquad state both persist on the object.

```js
let p = { fc: 200, Q: 1.0, fs: 44100 }
for (let buf of stream) {
  p.fc = 200 + lfo() * 1800   // mutate in-place — state preserved
  variableBandwidth(buf, p)
}
```

`fc` above 0.49 of the sample rate is held there, in the direct call and the `/audio` processor: past Nyquist the section's poles leave the unit circle, and every `/audio` processor of @audio/filter and @audio/eq keeps this one rule.

In the `/audio` processor a new `type` moves the output from the old type to the new over 20 ms: the three types share one denominator, so during the fade the section runs in direct form, each type's numerator on the same history, and the output is the two types' own renders crossfaded (switched in one sample, lowpass to highpass read ×1105 on a 220 Hz tone). Each frame's coefficients are computed in the kernel by `@audio/biquad`'s arithmetic, so a frame passes no number to a call and a type change allocates nothing.

**Use when:** LFO-modulated filter cutoff, automated EQ sweeps, smooth filter animation.

**vs Direct biquad**: recalculating biquad coefficients per sample causes zipper noise; variable bandwidth avoids this.

---

Part of [@audio/filter](https://github.com/audiojs/filter) — the filter family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
