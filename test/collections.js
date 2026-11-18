// The child of util.js collections(): a manifest's process() called directly, as a real-time host calls it, with its
// inputs, outputs and params made once and every numeric param moved each call, each enum to its next value every 16
// calls (or all held, given 'fixed'); prints the young-generation collections seen over 2^17 warm calls. Given
// 'second', those of a second instance, made after a first has run warm, its values moving (state a kernel completed
// after its factory made it shows there: @audio/effect); 'second-fixed', the same with the defaults held
import { PerformanceObserver } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'

const [file, name, how] = process.argv.slice(2)   // how: 'moving', 'fixed' (the defaults held), 'second' or 'second-fixed'
const m = (await import(pathToFileURL(file)))[name]
let live = {}, F = 8
for (let [k, s] of Object.entries(m.params)) live[k] = s.type === 'number' ? Float32Array.of(s.default) : s.default
let make = () => m({ sampleRate: 48000, maxBlockSize: 128, maxChannels: 2, params: live, buffers: {} }), proc = make()
let ins = [[0, 1].map(c => Float32Array.from({ length: F }, (_, i) => Math.sin(i * 0.7 + c) * 0.5))], outs = [[new Float32Array(F), new Float32Array(F)]]
let nums = Object.entries(m.params).filter(([, s]) => s.type === 'number').map(([k, s]) => [live[k], s])
let enums = Object.entries(m.params).filter(([, s]) => s.type === 'enum')
let vals = Array.from({ length: 64 }, (_, j) => nums.map(([, s]) => Math.fround(s.min + (s.max - s.min) * (0.5 + 0.5 * Math.sin(j * 0.1)))))
let run = n => { for (let i = 0; i < n; i++) { let v = vals[i & 63]; if (!how.endsWith('fixed')) { for (let k = 0; k < nums.length; k++) nums[k][0][0] = v[k]; if ((i & 15) === 0) for (let [k, s] of enums) live[k] = s.values[(i >> 4) % s.values.length] } proc(ins, outs, live) } }
run(1 << 15)
run(1 << 15)
if (how.startsWith('second')) { proc = make(); run(1 << 15); run(1 << 15) }
globalThis.gc()
let gcs = 0, obs = new PerformanceObserver(l => { gcs += l.getEntries().length })
obs.observe({ entryTypes: ['gc'] })
run(1 << 17)
await new Promise(r => setTimeout(r, 20))
gcs += obs.takeRecords?.().length ?? 0
obs.disconnect()
process.stdout.write(String(gcs))
