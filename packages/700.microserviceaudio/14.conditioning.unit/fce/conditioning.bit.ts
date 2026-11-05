export interface SomaticMeters {
    somaticFatigueBps?: number
    physicalPainBps?: number
    refusalStrainBps?: number
    paranoiaPressureBps?: number
}

export interface SomaticConditioningPayload {
    characterId: string
    dialogueText: string
    emotionalTag?: string
    meters?: SomaticMeters
    activeConditions?: string[]
    bannedKineticVerbs?: string[]
}

export interface ConditionedSomaticResult {
    status: 'VALID' | 'BREACH'
    characterId: string
    isPhonationFeasible: boolean
    activeConditions: string[]
    meters: Required<SomaticMeters>
    error?: string
}

export default interface ConditioningBit {
    idx: string
    src?: string
    val?: number
    dat?: SomaticConditioningPayload
    result?: ConditionedSomaticResult
    slv?: (result: { cndBit: ConditioningBit }) => void
}
