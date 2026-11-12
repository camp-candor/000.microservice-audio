import type LoudnessBit from './loudness.bit.js'

export type LoudnessDeliveryStandard =
    'WEB_STREAMING' | 'BROADCAST_ATSC' | 'BROADCAST_EBU'

export default interface Loudness {
    idx: string
    activeStandard: LoudnessDeliveryStandard
    auditsCompleted: number
    calibrationsCompleted: number
    loudnessBits: Record<string, LoudnessBit>
}
