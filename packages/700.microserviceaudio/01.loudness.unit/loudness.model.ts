import type Loudness from './fce/loudness.interface.js'
import type LoudnessBit from './fce/loudness.bit.js'

export class LoudnessModel implements Loudness {
    idx: string = '01.loudness'
    auditsCompleted: number = 0
    loudnessBits: Record<string, LoudnessBit> = {}
}
