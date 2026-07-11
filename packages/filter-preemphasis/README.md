# @audio/filter-preemphasis [![npm](https://img.shields.io/npm/v/@audio/filter-preemphasis)](https://www.npmjs.com/package/@audio/filter-preemphasis) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Pre-emphasis / de-emphasis filter

```
npm install @audio/filter-preemphasis
```

```js
import { emphasis, deemphasis } from '@audio/filter-preemphasis'
```

First-order highpass (emphasis) and its inverse (de-emphasis) — used before and after coding or transmission.

$H(z) = 1 - \alpha z^{-1}$ (emphasis) &nbsp;/&nbsp; $H(z) = \dfrac{1}{1 - \alpha z^{-1}}$ (de-emphasis)

**Rolloff**: emphasis boosts above $f_c = \frac{(1-\alpha) f_s}{2\pi}$ — $\alpha = 0.97$ gives ~210 Hz at 44.1 kHz<br>
**Inverse pair**: `deemphasis` exactly cancels `emphasis` — $H_e(z) \cdot H_d(z) = 1$ (round-trip error ~5.5e-17)

```js
emphasis(buffer, { alpha: 0.97 })    // before encoding
deemphasis(buffer, { alpha: 0.97 })  // after decoding — exact inverse
```

| Function | Param | Default | |
|---|---|---|---|
| `emphasis` | `alpha` | `0.97` | GSM/AMR speech coding convention |
| `deemphasis` | `alpha` | `0.97` | must match the `emphasis` call it inverts |

Pass the same `params` object on every call to persist the one-pole state across blocks.

**Use when:** speech coding (GSM, AMR uses $\alpha = 0.97$), tape recording, FM broadcasting.

---

Part of [@audio/filter](https://github.com/audiojs/filter) — the filter family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
