import type Peaks from './fce/peaks.interface.js'
import type PeaksBit from './fce/peaks.bit.js'

export class PeaksModel implements Peaks {
    idx: string = '02.peaks'
    scansCompleted: number = 0
    peaksBits: Record<string, PeaksBit> = {}
}
