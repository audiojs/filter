# @audio/filter-korg35 [![npm](https://img.shields.io/npm/v/@audio/filter-korg35)](https://www.npmjs.com/package/@audio/filter-korg35) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Korg MS-20 style filter (Korg35)

```
npm install @audio/filter-korg35
```

```js
import korg35 from '@audio/filter-korg35'
```

Korg MS-10/MS-20, 1978 — 2-pole filter with lowpass and highpass outputs from nonlinear feedback.

**Topology**: 2 cascaded one-pole sections with nonlinear feedback; HP = input − LP<br>
**Response**: $-12\,\text{dB/oct}$; resonance 0–1 adds damping/saturation character — no resonant peak, no self-oscillation at any setting (2 real poles in the loop can't reach the −180° phase Barkhausen's criterion needs at any finite, audible frequency, unlike Moog/Diode's 4-pole loops)<br>
**Complementarity**: LP+HP=input holds exactly only at resonance=0 (verified to 1e-16); at resonance>0 the HP tap's extra feedback term makes LP+HP diverge from the input (measured −7.5 dB to +1.4 dB error at resonance=0.8 across 200 Hz–5 kHz)

```js
korg35(buffer, { fc: 1000, resonance: 0.5, type: 'lowpass',  fs: 44100 })
korg35(buffer, { fc: 1000, resonance: 0.5, type: 'highpass', fs: 44100 })
```

**Circuit**: Korg MS-10/MS-20 (1978)<br>
**Analysis**: Stilson & Smith, "Analyzing the Korg MS-20 Filter" (1996); Zavalishin, *The Art of VA Filter Design* (2012), Ch. 5<br>
**vs Moog ladder**: 2-pole ($-12\,\text{dB/oct}$) vs 4-pole ($-24\,\text{dB/oct}$); Korg35 has both LP and HP taps from one circuit, but no self-oscillation

| Param | Default | |
|---|---|---|
| `fc` | `1000` | cutoff frequency, Hz |
| `resonance` | `0` | 0–1; feedback k = 2·resonance; never self-oscillates |
| `fs` | `44100` | sample rate, Hz |
| `drive` | `1` | input gain into the feedback-path tanh saturation |
| `type` | `'lowpass'` | `'lowpass'` or `'highpass'` |

Pass the same `params` object on every call to persist the 2 stage states across blocks.

**Use when:** MS-20-style aggressive filter character with a highpass tap available; use `moogLadder` for 4-pole warmth and true self-oscillation instead.

---

Part of [@audio/filter](https://github.com/audiojs/filter) — the filter family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
