import type PipelineBit from './pipeline.bit.js'
import type { StemTimingReceipt } from '../../97.collect.unit/fce/collect.interface.js'
import type { VisemeSidecarManifest } from '../../17.composition.unit/fce/composition.interface.js'

export type PipelineStageName =
    | '08.SCHEMAS_INGRESS'
    | '09.PROFILE_RESOLUTION'
    | '14.SOMATIC_CONDITIONING'
    | '12.ACOUSTIC_DSP'
    | '15.DIALOGUE_PROSODY'
    | '96.MODEL_MMAP'
    | '10.GENERATE_SYNTHESIS'
    | '05.VERIFICATION_QC'
    | '97.COLLECT_LEDGER'
    | '17.COMPOSITION_SIDECAR'

export interface PipelineStageTrace {
    stage: PipelineStageName
    unit: string
    status: 'PASSED' | 'FAILED' | 'SKIPPED'
    durationMs: number
    detail: string
    error?: string
}

export interface PipelineExecutionReport {
    status: 'PASSED' | 'FAILED'
    lineId: string
    characterId: string
    seriesSlug: string
    stagesCompletedCount: number
    totalStagesCount: number
    stageTraces: PipelineStageTrace[]
    stemReceipt?: StemTimingReceipt
    visemeSidecar?: VisemeSidecarManifest
    causalVaeFrames?: number
    failedStage?: PipelineStageName
    error?: string
}

export default interface Pipeline {
    idx: string
    pipelinesExecutedCount: number
    pipelinesPassedCount: number
    pipelinesFailedCount: number
    lastReport: PipelineExecutionReport | null
    pipelineBits: Record<string, PipelineBit>
}
