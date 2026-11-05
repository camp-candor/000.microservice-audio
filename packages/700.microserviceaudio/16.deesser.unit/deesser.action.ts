import { Action } from '../99.core/interface/action.interface.js'
import DeesserBit from './fce/deesser.bit.js'

export const INIT_DEESSER = '[Deesser action] Init Deesser'
export class InitDeesser implements Action {
    readonly type = INIT_DEESSER
    constructor(public bale: DeesserBit) {}
}

export const UPDATE_DEESSER = '[Deesser action] Update Deesser'
export class UpdateDeesser implements Action {
    readonly type = UPDATE_DEESSER
    constructor(public bale: DeesserBit) {}
}

export const APPLY_DYNAMIC_DEESSER = '[Deesser action] Apply Dynamic Deesser'
export class ApplyDynamicDeesser implements Action {
    readonly type = APPLY_DYNAMIC_DEESSER
    constructor(public bale: DeesserBit) {}
}

export type Actions = InitDeesser | UpdateDeesser | ApplyDynamicDeesser
