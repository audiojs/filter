# @audio/filter-moog-ladder [![npm](https://img.shields.io/npm/v/@audio/filter-moog-ladder)](https://www.npmjs.com/package/@audio/filter-moog-ladder) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Moog 4-pole transistor ladder filter (-24 dB/oct lowpass with resonance)

```
npm install @audio/filter-moog-ladder
```

```js
import moogLadder from '@audio/filter-moog-ladder'
```

Robert Moog's 4-pole transistor ladder, 1965 — the most imitated filter in electronic music.

**Circuit**: 4 cascaded one-pole transistor ladder sections, global feedback from output to input<br>
**Implementation**: Zero-delay feedback (ZDF) via trapezoidal integration — Zavalishin, *The Art of VA Filter Design* (2012), Ch. 6<br>
**Response**: $-24\,\text{dB/oct}$ lowpass; resonance peak at $f_c$; self-oscillation (sine wave) at resonance=1<br>
**Nonlinearity**: $\tanh$ saturation at input (transistor ladder characteristic)

```js
let params = { fc: 800, resonance: 0.7, fs: 44100 }
moogLadder(buffer, params)

// Self-oscillation — runs indefinitely from a single impulse
let silent = new Float64Array(4096); silent[0] = 0.01
moogLadder(silent, { fc: 1000, resonance: 1, fs: 44100 })
```

**Patent**: Moog (1965) US3475623<br>
**vs Diode ladder**: Moog saturates only at input; diode saturates at each stage — different character at high resonance

| Param | Default | |
|---|---|---|
| `fc` | `1000` | cutoff frequency, Hz |
| `resonance` | `0` | 0–1; feedback k = 4·resonance; self-oscillates exactly at 1 |
| `fs` | `44100` | sample rate, Hz |
| `drive` | `1` | input gain into the tanh saturation; `0` mutes the signal |

Pass the same `params` object on every call to persist the 4 stage states across blocks.

**Use when:** synth-filter warmth, resonance, and true self-oscillation at resonance=1 — the reference analog-modeled lowpass.

---

Part of [@audio/filter](https://github.com/audiojs/filter) — the filter family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
