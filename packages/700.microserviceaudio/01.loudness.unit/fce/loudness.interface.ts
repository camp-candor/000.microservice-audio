import type LoudnessBit from './loudness.bit.js'

export default interface Loudness {
    idx: string
    auditsCompleted: number
    loudnessBits: Record<string, LoudnessBit>
}
