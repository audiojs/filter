# @audio/speech-world

> WORLD-style vocoder — source-filter decomposition: F0 + spectral envelope + aperiodicity (Morise 2016)

**Deferred — deliberately.** WORLD is a flagship-scale port (DIO/Harvest F0, CheapTrick envelope,
D4C aperiodicity, ~5k lines of reference C++). A watered-down "world-like" pipeline would carry the
name without the quality; the honest options are a faithful port or a WASM build of the reference —
both their own project. Interim coverage: `@audio/speech-lpc` (envelope), `@audio/pitch-pyin` (F0),
`@audio/voice-glottis` + `@audio/voice-tract` (synthesis side).
