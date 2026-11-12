import type Loudness from './fce/loudness.interface.js'
import type { LoudnessDeliveryStandard } from './fce/loudness.interface.js'
import type LoudnessBit from './fce/loudness.bit.js'

export class LoudnessModel implements Loudness {
    idx: string = '01.loudness'
    activeStandard: LoudnessDeliveryStandard = 'WEB_STREAMING'
    auditsCompleted: number = 0
    calibrationsCompleted: number = 0
    loudnessBits: Record<string, LoudnessBit> = {}
}
