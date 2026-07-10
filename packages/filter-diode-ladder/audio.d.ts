// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'diode' */
export interface DiodeOptions {
  /** 20..20000 Hz (default 1000) */
  "fc"?: Auto
  /** 0..1.2 (default 0) */
  "resonance"?: Auto
  /** 0.1..10 (default 1) */
  "drive"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const diode: {
  (ctx: Ctx): Process
  channels: "any"
  params: {
    /** 20..20000 Hz (default 1000) */
    "fc": { type: "number", default: 1000 }
    /** 0..1.2 (default 0) */
    "resonance": { type: "number", default: 0 }
    /** 0.1..10 (default 1) */
    "drive": { type: "number", default: 1 }
  }
}
