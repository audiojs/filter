type Buf = Float32Array | Float64Array | number[]
interface BiquadCoef { b0: number; b1: number; b2: number; a1: number; a2: number }
type SOS = BiquadCoef[]

export interface Formant { fc: number; bw?: number; gain?: number } // bw default 50, gain default 1

export interface FormantParams {
  formants?: Formant[] // default 3-formant /a/ vowel bank
  fs?: number
  [key: string]: unknown
}

/** Parallel formant filter bank for vowel synthesis, in-place */
declare function formant(data: Buf, params: FormantParams): Buf
export default formant
