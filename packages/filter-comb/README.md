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

**Use when:** flanging, chorus (with modulated delay), Karplus-Strong string synthesis, room mode modeling.

---

Part of [@audio/filter](https://github.com/audiojs/filter) — the filter family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
