type Buf = Float32Array | Float64Array

export interface DcBlockerParams {
  /** pole radius, default 0.995 — cutoff ≈ (1−R)·fs / (2π); 0.995 gives ~35 Hz at 44.1 kHz */
  R?: number
  /** input state x[n-1], default 0 (persisted) */
  x1?: number
  /** output state y[n-1], default 0 (persisted) */
  y1?: number
  [key: string]: unknown
}

/** DC blocker: H(z) = (1 − z⁻¹) / (1 − R·z⁻¹). Removes DC offset, in place. */
declare function dcBlocker(data: Buf, params: DcBlockerParams): Buf
export default dcBlocker
