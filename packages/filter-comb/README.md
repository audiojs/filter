# @audio/filter-comb [![npm](https://img.shields.io/npm/v/@audio/filter-comb)](https://www.npmjs.com/package/@audio/filter-comb) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Comb filter — feedforward (FIR) and feedback (IIR)

```
npm install @audio/filter-comb
```

```js
import comb from '@audio/filter-comb'
```

Adds a delayed copy of the signal to itself — notches and peaks at harmonics of $f_s / D$.

**Feedforward**: $H(z) = 1 + g \cdot z^{-D}$ — dips at $f = \frac{(2k+1) f_s}{2D}$, depth depends on $g$: a true null only at $|g|=1$; the default $g=0.5$ gives a $-6\,\text{dB}$ dip, not a notch<br>
**Feedback**: $H(z) = \dfrac{1}{1 - g \cdot z^{-D}}$ — peaks at $f = \frac{k \cdot f_s}{D}$

```js
comb(buffer, { delay: 100, gain: 0.6, type: 'feedback' })
```

| Param | Default | |
|---|---|---|
| `delay` | — | required, delay length in samples (`D`) |
| `gain` | `0.5` | feedforward/feedback coefficient `g` |
| `type` | `'feedforward'` | `'feedforward'` (FIR, dips) or `'feedback'` (IIR, peaks) |

Pass the same `params` object on every call — the ring buffer and write pointer persist across blocks:

```js
let params = { delay: 100, gain: 0.6, type: 'feedback' }
for (let buf of stream) comb(buf, params)
```

The delay is live, read as @audio/effect's delay lines read theirs: a delay between two samples is read between them, and a new one glides across the call from where the last call ended, the read no faster than double speed and no slower than half. A delay longer than the ring holds makes a new ring, empty; the `/audio` processor makes its ring for the longest delay, 100 ms, so its delay moves without one. Its `gain` is smoothed (20 ms) and glided sample by sample: a host's ramp of it is one line, the same however the host cuts its calls (it hands each call the value at its first frame, so the line is played 32 frames late); held, it is the value itself. A new `type` still switches in one sample: feedforward keeps its input in the line and feedback its output, so a fade would need the feedback recursion running at all times.

**Use when:** flanging, chorus (with modulated delay), Karplus-Strong string synthesis, room mode modeling.

---

Part of [@audio/filter](https://github.com/audiojs/filter) — the filter family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
