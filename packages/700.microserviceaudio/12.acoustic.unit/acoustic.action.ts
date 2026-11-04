import { Action } from '../99.core/interface/action.interface'
import AcousticBit from './fce/acoustic.bit'

// Acoustic actions

export const INIT_ACOUSTIC = '[Acoustic action] Init Acoustic'
export class InitAcoustic implements Action {
    readonly type = INIT_ACOUSTIC
    constructor(public bale: AcousticBit) {}
}

export const UPDATE_ACOUSTIC = '[Acoustic action] Update Acoustic'
export class UpdateAcoustic implements Action {
    readonly type = UPDATE_ACOUSTIC
    constructor(public bale: AcousticBit) {}
}

export type Actions = InitAcoustic | UpdateAcoustic
