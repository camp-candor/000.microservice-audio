import type { PipelineExecutionReport } from './pipeline.interface.js'
import type { SeriesLexiconDictionary } from '../../15.dialogue.unit/fce/dialogue.interface.js'

export interface SynthesisPipelinePayload {
    lineId: string
    seriesSlug: string
    characterId: string
    rawDialogueText: string
    outputWavPath: string
    sidecarOutputPath?: string
    mruType?: 'stimulus' | 'reflex' | 'instinctive_reaction' | 'rational_action'
    requestedCadence?: string
    bannedCadences?: string[]
    targetEngine?: 'styletts2' | 'parler' | 'piper' | 'cosyvoice' | 'kokoro'
    somaticState?: {
        pulmonaryFatigueBp?: number
        emotionalStressBp?: number
        vocalStrainBp?: number
        isConscious?: boolean
        hasFunctionalGlottis?: boolean
    }
    lexiconOverride?: SeriesLexiconDictionary
    syntheticPcmOverride?: Buffer
    targetLufs?: number
    maxTruePeakDbTp?: number
    fps?: number
}

export default interface PipelineBit {
    idx: string
    src?: string
    val?: number
    dat?: SynthesisPipelinePayload
    report?: PipelineExecutionReport
    error?: string
    slv?: (result: { pplBit: PipelineBit }) => void
}
