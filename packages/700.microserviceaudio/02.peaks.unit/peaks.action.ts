import { Action } from '../99.core/interface/action.interface'
import PeaksBit from './fce/peaks.bit'

// Peaks actions

export const INIT_PEAKS = '[Peaks action] Init Peaks'
export class InitPeaks implements Action {
    readonly type = INIT_PEAKS
    constructor(public bale: PeaksBit) {}
}

export const UPDATE_PEAKS = '[Peaks action] Update Peaks'
export class UpdatePeaks implements Action {
    readonly type = UPDATE_PEAKS
    constructor(public bale: PeaksBit) {}
}

export type Actions = InitPeaks | UpdatePeaks
