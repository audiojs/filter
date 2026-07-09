# @audio/biquad

> The audio-side biquad — RBJ cookbook coefficients + stateful SOS kernel.

One coefficient/kernel source for the `@audio` ecosystem. Coefficients follow Web Audio conventions (`bandpass` = constant 0 dB peak gain); differential-tested against [digital-filter](https://github.com/audiojs/digital-filter) (the generic design reference — butterworth, linkwitz-riley, matched-z stay there) to 1e-9. Zero dependencies.

```js
import { lowpass, peaking, filter, process, step, state, cascade, magnitude } from '@audio/biquad'

// coefficients — (fc, Q, fs[, dB]), normalized a0 = 1
let c = lowpass(1000, 0.707, 44100)          // also: highpass, bandpass, notch, allpass,
let pk = peaking(2000, 1, 44100, 6)          //       peaking, lowshelf, highshelf

// params-convention kernel — coefs + state ride the params object (streaming: state persists across calls)
let params = { coefs: [c, pk] }
filter(chunk, params)

// section-level kernel
let s = state()
process(chunk, c, s)                          // buffer through one section, in place
let y = step(c, s, x)                         // one sample (sidechain/per-sample use)
cascade(chunk, [c, pk])                       // buffer through SOS chain

magnitude(c, 440, 44100)                      // |H(f)| — analysis/plotting
```

Transposed direct-form-II; `Float64Array(2)` state per section; all processing in place.

## See also

- [`@audio/filter-biquad`](https://github.com/audiojs/filter/tree/main/packages/filter-biquad) — audio-facing filter atoms built on this kernel
- [`digital-filter`](https://github.com/audiojs/digital-filter) — generic filter design (scijs layer)

## License

MIT
