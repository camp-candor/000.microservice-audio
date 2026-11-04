import { Action } from '../99.core/interface/action.interface'
import DeesserBit from './fce/deesser.bit'

// Deesser actions

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

export type Actions = InitDeesser | UpdateDeesser
