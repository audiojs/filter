type Buf = Float32Array | Float64Array | number[]
interface BiquadCoef { b0: number; b1: number; b2: number; a1: number; a2: number }
type SOS = BiquadCoef[]

export interface VocoderParams {
  bands?: number     // number of bands (default 16)
  fmin?: number      // lowest band Hz (default 100)
  fmax?: number      // highest band Hz (default 8000)
  fs?: number        // sample rate (default 44100)
  [key: string]: unknown
}

/** Channel vocoder — applies modulator spectral envelope to carrier. Always returns a new Float64Array (does not mutate carrier/modulator). */
declare function vocoder(carrier: Buf, modulator: Buf, params: VocoderParams): Float64Array
export default vocoder
