# @audio/filter-diode-ladder [![npm](https://img.shields.io/npm/v/@audio/filter-diode-ladder)](https://www.npmjs.com/package/@audio/filter-diode-ladder) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Diode ladder filter (Roland TB-303 / EMS VCS3 style)

```
npm install @audio/filter-diode-ladder
```

```js
import diodeLadder from '@audio/filter-diode-ladder'
```

Roland TB-303 / EMS VCS3 style — per-stage saturation gives the characteristic acid "squelch".

**Circuit**: Roland TB-303, EMS VCS3, EDP Wasp<br>
**Key difference from Moog**: stages are bidirectionally coupled — no unity-gain buffers between them (unlike Moog), so each stage loads its neighbors; solved as one tridiagonal system per sample (Thomas algorithm) instead of Moog's simple forward cascade<br>
**Character**: preserves more bass at high resonance than Moog — closed-form DC gain $1/(1 + 4\cdot\text{resonance})$ vs Moog's $1/(1 + 4\cdot\text{resonance}\cdot(1+G+G^2+G^3+G^4))$, $G<1$ — and more "squelchy"/aggressive due to the per-stage $\tanh$<br>
**Implementation**: ZDF (zero-delay feedback) via trapezoidal integration — Zavalishin, *The Art of VA Filter Design* (2012); Pirkle, *Designing Audio Effect Plugins in C++*, 2nd ed. (2019), Ch. 10<br>
**Stability**: bounded (per-stage $\tanh$-saturated) across the documented 0–1 range and well beyond; self-oscillates near resonance≈1.15–1.2 — higher than Moog's exact 1, since the extra per-stage $\tanh$ adds damping

```js
let params = { fc: 500, resonance: 0.8, fs: 44100 }
diodeLadder(buffer, params)
```

| Param | Default | |
|---|---|---|
| `fc` | `1000` | cutoff frequency, Hz |
| `resonance` | `0` | 0–1; feedback k = 4·resonance (same mapping as `moogLadder`); self-oscillates near ≈1.15–1.2 |
| `fs` | `44100` | sample rate, Hz |
| `drive` | `1` | input gain into each stage's tanh saturation; `0` mutes the signal |

Pass the same `params` object on every call to persist the 4 stage states across blocks.

**Use when:** acid basslines, squelchy synth leads — resonance character that stays bounded (not self-oscillating) across most of the range, unlike `moogLadder`.

---

Part of [@audio/filter](https://github.com/audiojs/filter) — the filter family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
