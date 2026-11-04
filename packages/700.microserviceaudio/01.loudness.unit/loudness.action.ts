import { Action } from '../99.core/interface/action.interface'
import LoudnessBit from './fce/loudness.bit'

// Loudness actions

export const INIT_LOUDNESS = '[Loudness action] Init Loudness'
export class InitLoudness implements Action {
    readonly type = INIT_LOUDNESS
    constructor(public bale: LoudnessBit) {}
}

export const UPDATE_LOUDNESS = '[Loudness action] Update Loudness'
export class UpdateLoudness implements Action {
    readonly type = UPDATE_LOUDNESS
    constructor(public bale: LoudnessBit) {}
}

export type Actions = InitLoudness | UpdateLoudness
