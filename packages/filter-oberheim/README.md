# @audio/filter-oberheim [![npm](https://img.shields.io/npm/v/@audio/filter-oberheim)](https://www.npmjs.com/package/@audio/filter-oberheim) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Oberheim SEM state-variable filter (–12 dB/oct multimode)

```
npm install @audio/filter-oberheim
```

```js
import oberheim from '@audio/filter-oberheim'
```

Oberheim SEM (1974) — 2-pole state-variable filter with four modes from one circuit.

**Topology**: 2 trapezoidal integrators with nonlinear feedback; multimode output (LP/HP/BP/notch)<br>
**Response**: $-12\,\text{dB/oct}$; warm, musical resonance; continuous mode morphing<br>
**Implementation**: ZDF (zero-delay feedback) via trapezoidal integration — Zavalishin, *The Art of VA Filter Design* (2012), Ch. 4–5; $\tanh$ saturation on the integrator states (not on a separate `drive` input — unlike the ladder filters in this repo, `oberheim` takes no `drive` parameter)

```js
oberheim(buffer, { fc: 1000, resonance: 0.5, type: 'lowpass',  fs: 44100 })
oberheim(buffer, { fc: 1000, resonance: 0.5, type: 'highpass', fs: 44100 })
oberheim(buffer, { fc: 1000, resonance: 0.5, type: 'bandpass', fs: 44100 })
oberheim(buffer, { fc: 1000, resonance: 0.5, type: 'notch',    fs: 44100 })
```

**Circuit**: Oberheim SEM (1974), Two Voice, Four Voice, Eight Voice<br>
**vs Moog/Korg**: 2-pole like Korg35 but true state-variable topology; LP/HP/BP/notch from one circuit; warmer resonance character

| Param | Default | |
|---|---|---|
| `fc` | `1000` | cutoff frequency, Hz |
| `resonance` | `0` | 0–1; damping R = 1 − resonance (inverted — resonance=1 gives R=0, max resonance); bandpass peak gain is exactly 1/(2R) |
| `fs` | `44100` | sample rate, Hz |
| `type` | `'lowpass'` | `'lowpass'`, `'highpass'`, `'bandpass'`, or `'notch'` |

Pass the same `params` object on every call to persist the 2 integrator states across blocks.

**Use when:** multimode synth filter (LP/HP/BP/notch from one set of coefficients) with warm, musical resonance — mode-switch by changing `type` without recomputing coefficients.

---

Part of [@audio/filter](https://github.com/audiojs/filter) — the filter family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
