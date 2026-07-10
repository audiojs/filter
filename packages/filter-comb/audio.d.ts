// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'comb' */
export interface CombOptions {
  /** 0.05..100 ms (default 10) */
  "delay"?: Auto
  /** -0.99..0.99 (default 0.5) */
  "gain"?: Auto
  /** default "feedforward" */
  "type"?: "feedforward" | "feedback"
  at?: number | string
  duration?: number | string
}

export declare const comb: {
  (ctx: Ctx): Process
  channels: "any"
  tail: 0.5
  params: {
    /** 0.05..100 ms (default 10) */
    "delay": { type: "number", default: 10 }
    /** -0.99..0.99 (default 0.5) */
    "gain": { type: "number", default: 0.5 }
    /** default "feedforward" */
    "type": { type: "enum", values: ["feedforward","feedback"], default: "feedforward" }
  }
}
