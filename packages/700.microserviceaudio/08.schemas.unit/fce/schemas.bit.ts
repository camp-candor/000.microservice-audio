import type {
    IngressSceneAST,
    IngressDialogueLine,
} from '../val/dialogueAst.val.js'

export interface IngressValidationReport {
    status: 'PASSED' | 'FAILED'
    sceneId: string
    totalLines: number
    snapshotHashVerified: boolean
    parityVerified: boolean
    error?: string
}

export interface ScriptParityReport {
    status: 'PASSED' | 'FAILED'
    lineId: string
    character: string
    mismatches: string[]
    error?: string
}

export default interface SchemasBit {
    idx: string
    src?: string
    val?: number
    dat?: {
        sceneAst?: IngressSceneAST | unknown
        dialogueLine?: IngressDialogueLine | unknown
        expectedScriptText?: string
        bannedPronunciations?: string[]
    }
    result?: IngressValidationReport
    parityResult?: ScriptParityReport
    slv?: (result: { schBit: SchemasBit }) => void
}
