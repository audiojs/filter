# @audio/filter-biquad [![npm](https://img.shields.io/npm/v/@audio/filter-biquad)](https://www.npmjs.com/package/@audio/filter-biquad) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Audio-facing biquad filters — highpass, lowpass, bandpass, notch, allpass (Hz/Q params, per-channel state)

```
npm install @audio/filter-biquad
```

```js
import { highpass, lowpass, bandpass, notch, allpass } from '@audio/filter-biquad'
```

Hz/Q-parameterized wrappers over the shared [`@audio/biquad`](https://github.com/audiojs/filter/tree/main/packages/biquad) kernel — one call per filter shape, coefficients recomputed only when `fc`/`Q`/`fs`/`order` actually change, state cached on the `params` object.

```js
lowpass(buffer, { fc: 2000, fs: 44100 })                // 2nd-order (default) — no registration needed
highpass(buffer, { fc: 80, fs: 44100 })                  // rumble filter
bandpass(buffer, { fc: 1000, Q: 5, fs: 44100 })          // narrow band
notch(buffer, { fc: 50, Q: 30, fs: 44100 })              // remove 50 Hz mains hum
allpass.first(buffer, { a: 0.5 })                        // 1st-order, coefficient a
allpass.second(buffer, { fc: 1000, Q: 1, fs: 44100 })    // 2nd-order, center fc, quality Q
```

`lowpass`/`highpass` default to a 2nd-order RBJ biquad ($-12\,\text{dB/oct}$). For 4th-order-and-up Butterworth cascades, register a designer once — kept out of the default import so the common 2nd-order case stays dependency-free:

```js
import butterworth from 'digital-filter/iir/butterworth.js'

lowpass.useButterworth(butterworth)                       // once, before any order > 2 call
lowpass(buffer, { fc: 2000, order: 4, fs: 44100 })        // 4th-order Butterworth, -24 dB/oct
```

| Function | Param | Default | |
|---|---|---|---|
| `lowpass`, `highpass` | `fc` | — | required, Hz |
| | `order` | `2` | `2` = RBJ biquad; `4+` = Butterworth (needs `useButterworth`) |
| | `Q` | `0.707` | quality factor (1/√2, maximally flat) |
| | `fs` | `44100` | sample rate, Hz |
| `bandpass` | `fc` | — | required, center Hz |
| | `Q` | `0.707` | narrower band = higher Q (differs from the raw `@audio/biquad` kernel's default of `1`) |
| | `fs` | `44100` | sample rate, Hz |
| `notch` | `fc` | — | required, null frequency Hz |
| | `Q` | `30` | notch width — lower (e.g. `5`) is wider |
| | `fs` | `44100` | sample rate, Hz |
| `allpass.first` | `a` | — | required, pole at z = −a |
| `allpass.second` | `fc`, `Q`, `fs` | — / `0.707` / `44100` | RBJ cookbook allpass |

Pass the same `params` object on every call to persist state across blocks:

```js
let params = { fc: 1000, fs: 44100 }
for (let buf of stream) lowpass(buf, params)
```

**Use when:** building an audio-facing biquad filter (Hz/Q, not raw SOS coefficients); bypass this and use `@audio/biquad` directly when you already have coefficients or need cascade/analysis primitives.

---

Part of [@audio/filter](https://github.com/audiojs/filter) — the filter family umbrella. This README is generated from the umbrella docs.

MIT © [audiojs](https://github.com/audiojs)
