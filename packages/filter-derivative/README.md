# @audio/filter-derivative [![npm](https://img.shields.io/npm/v/@audio/filter-derivative)](https://www.npmjs.com/package/@audio/filter-derivative) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Derivative / integral — FFmpeg aderivative/aintegral first-difference & running-sum pair

```
npm install @audio/filter-derivative
```

```js
import { derivative, integral } from '@audio/filter-derivative'
```

First-difference and running-sum — an exact inverse pair (FFmpeg's `aderivative`/`aintegral`).

$H_d(z) = 1 - z^{-1}$ (derivative) &nbsp;/&nbsp; $H_i(z) = \dfrac{1}{1 - z^{-1}}$ (integral, leak=1)

**Inverse pair**: `integral` at `leak: 1` exactly reconstructs the input passed to `derivative` — the running sum telescopes<br>
**Leak**: `leak < 1` bleeds the accumulator per sample so DC-biased material converges to a finite value ($\frac{x_{dc}}{1-\text{leak}}$) instead of drifting

```js
derivative(buffer, {})
integral(buffer, { leak: 1 })    // 1 = exact FFmpeg aintegral; <1 for stability on real program material
```

| Function | Param | Default | |
|---|---|---|---|
| `derivative` | `prev` | `0` | previous sample (persisted) |
| `integral` | `leak` | `1` | `1` = exact inverse of `derivative`; `<1` anti-drift |
| | `acc` | `0` | running-sum accumulator (persisted) |

Pass the same `params` object on every call to persist state across blocks.

**Use when:** edge/transient detection (derivative), reconstructing a signal from its differenced form (integral), envelope-adjacent accumulation.

---

Part of [@audio/filter](https://github.com/audiojs/filter) — the filter family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
