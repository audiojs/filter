# @audio/filter-dcblocker [![npm](https://img.shields.io/npm/v/@audio/filter-dcblocker)](https://www.npmjs.com/package/@audio/filter-dcblocker) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

DC blocking filter

```
npm install @audio/filter-dcblocker
```

```js
import dcBlocker from '@audio/filter-dcblocker'
```

Removes DC offset — the simplest useful filter.

$H(z) = \dfrac{1 - z^{-1}}{1 - Rz^{-1}}$

**Topology**: zero at $z = 1$ (DC), pole at $z = R$<br>
**Cutoff**: $f_c \approx \frac{(1-R) f_s}{2\pi}$ — $R = 0.995$ gives ~35 Hz at 44.1 kHz

```js
let params = { R: 0.995 }
dcBlocker(buffer, params)
```

| Param | Default | |
|---|---|---|
| `R` | `0.995` | pole radius — closer to 1 pushes the cutoff lower |

Pass the same `params` object on every call to persist the one-pole state across blocks.

**Use when:** removing DC bias before processing, preventing lowpass filter saturation.

---

Part of [@audio/filter](https://github.com/audiojs/filter) — the filter family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
