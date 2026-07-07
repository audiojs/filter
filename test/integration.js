import 'tst'
import * as audio from '../index.js'
import butterworth from 'digital-filter/iir/butterworth.js'
audio.highpass.useButterworth(butterworth)
audio.lowpass.useButterworth(butterworth)

// No filter-chain / cross-domain tests currently exist — every test in the
// suite exercises a single domain. This file is kept as the designated home
// for future tests that combine filters from multiple domains.
