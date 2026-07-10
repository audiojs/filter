// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'bandpass' */
export interface BandpassOptions {
  /** 20..20000 Hz (default 1000) */
  "fc"?: Auto
  /** 0.1..20 (default 0.707) */
  "Q"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const bandpass: {
  (ctx: Ctx): Process
  channels: "any"
  params: {
    /** 20..20000 Hz (default 1000) */
    "fc": { type: "number", default: 1000 }
    /** 0.1..20 (default 0.707) */
    "Q": { type: "number", default: 0.707 }
  }
}

/** Chainable-host options for 'highpass' */
export interface HighpassOptions {
  /** 20..20000 Hz (default 1000) */
  "fc"?: Auto
  /** 0.1..20 (default 0.707) */
  "Q"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const highpass: {
  (ctx: Ctx): Process
  channels: "any"
  params: {
    /** 20..20000 Hz (default 1000) */
    "fc": { type: "number", default: 1000 }
    /** 0.1..20 (default 0.707) */
    "Q": { type: "number", default: 0.707 }
  }
}

/** Chainable-host options for 'lowpass' */
export interface LowpassOptions {
  /** 20..20000 Hz (default 1000) */
  "fc"?: Auto
  /** 0.1..20 (default 0.707) */
  "Q"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const lowpass: {
  (ctx: Ctx): Process
  channels: "any"
  params: {
    /** 20..20000 Hz (default 1000) */
    "fc": { type: "number", default: 1000 }
    /** 0.1..20 (default 0.707) */
    "Q": { type: "number", default: 0.707 }
  }
}
