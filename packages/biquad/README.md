# @audio/biquad

> The audio-side biquad — RBJ cookbook coefficients + stateful SOS kernel.

One coefficient/kernel source for the `@audio` ecosystem. Coefficients follow Web Audio conventions (`bandpass` = constant 0 dB peak gain); differential-tested against [digital-filter](https://github.com/audiojs/digital-filter) (the generic design reference — butterworth, linkwitz-riley, matched-z stay there) to 1e-9. Zero dependencies.

```js
import { lowpass, peaking, filter, process, step, state, cascade, magnitude, tail } from '@audio/biquad'

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

lowpass(2000, 0.707, 44100, c)                // a design writes into a section given it: a retune that allocates nothing
tail(c, 44100)                                // seconds it rings once its input stops, until 60 dB under the input
```

Transposed direct-form-II; `Float64Array(2)` state per section; all processing in place.

`tail(sos, fs)` is the tail a processor declares (CONTRACT.md): the seconds after the input stops until the output stays 60 dB under the input. After any input of peak 1 stops, the output k frames on is at most the sum of |h| from frame k of the impulse response h, so the frames until that rest is under 1e-3 are a tail no input can outlast. For one section the rest is found in closed form: past its first frame, h is the ring of the section's two poles, a geometric sum over each stretch where it keeps its sign (where a conjugate pair turns fast against its decay, |cos| is summed by its Fourier series to 64 terms, the rest of the series bounded, within 0.8 %). A cascade's h is summed as `process()` runs the sections, the rest past the sum bounded by their poles. 0 where the ring is 128 frames or under, Infinity for a pole on the unit circle. A DC step or a tone held at the resonance comes within a few percent of it: on 240 random sections and cascades (the eight shapes, 8 to 192 kHz) it is never under the rest summed directly and at most 3.3 % over (one section alone: on 600 random sections and 48 resonators about a quarter of the rate, never under and at most 0.3 % over), and the longest ring of an impulse, noise, a DC step and held tones through lowpass, highpass and bandpass sections at random settings comes to 0.76 to 1 of it (the least where a pole near Nyquist rings, which no tone under 0.49 of the rate drives as hard as an input alternating sign would). Cost, measured warm on a loaded machine: one section at most 0.05 ms however long it rings (fc 20 Hz, Q 30 at 192 kHz, 5.04 s); a cascade in proportion to its ring, about 0.1 ms for a few thousand frames and 3.3 ms for ten peaking sections ringing 0.29 s at 192 kHz.

## See also

- [`@audio/filter-biquad`](https://github.com/audiojs/filter/tree/main/packages/filter-biquad) — audio-facing filter atoms built on this kernel
- [`digital-filter`](https://github.com/audiojs/digital-filter) — generic filter design (scijs layer)

## License

MIT
