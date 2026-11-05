import type PeaksBit from './peaks.bit.js'

export default interface Peaks {
    idx: string
    scansCompleted: number
    peaksBits: Record<string, PeaksBit>
}
