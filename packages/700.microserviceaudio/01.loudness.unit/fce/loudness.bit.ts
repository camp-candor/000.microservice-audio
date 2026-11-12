import type { LoudnessDeliveryStandard } from './loudness.interface.js'

export interface LoudnessTargetProfile {
    targetLufs: number
    toleranceLufs: number
    maxTruePeakDbTp?: number
    standard?: LoudnessDeliveryStandard
    allowPeakClamping?: boolean
}

export interface LoudnessAuditReport {
    status: 'PASSED' | 'FAILED'
    filePath: string
    measuredLufs: number
    targetLufs: number
    deltaLufs: number
    error?: string
}

export interface LoudnessCalibrationReport {
    status: 'CALIBRATED' | 'FAILED' | 'CALIBRATION_CLIPPING_BREACH'
    filePath: string
    standard: LoudnessDeliveryStandard
    pass1MeasuredLufs: number
    pass2CalibratedLufs: number
    appliedGainDb: number
    postCalibrationPeakDbTp: number
    error?: string
}

export default interface LoudnessBit {
    idx: string
    src?: string
    val?: number
    dat?: {
        filePath: string
        profile?: LoudnessTargetProfile
        pcmBuffer?: Buffer
        sampleRate?: number
        outputPath?: string
    }
    result?: LoudnessAuditReport
    calibrationResult?: LoudnessCalibrationReport
    calibratedBuffer?: Buffer
    slv?: (result: { ldnBit: LoudnessBit }) => void
}
