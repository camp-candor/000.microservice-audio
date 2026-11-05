import type Conditioning from './fce/conditioning.interface.js'
import type ConditioningBit from './fce/conditioning.bit.js'

export class ConditioningModel implements Conditioning {
    idx: string = '14.conditioning'
    profilesProcessed: number = 0
    conditioningBits: Record<string, ConditioningBit> = {}
}
