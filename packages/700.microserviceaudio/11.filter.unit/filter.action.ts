import { Action } from '../99.core/interface/action.interface.js'
import FilterBit from './fce/filter.bit.js'

export const INIT_FILTER = '[Filter action] Init Filter'
export class InitFilter implements Action {
    readonly type = INIT_FILTER
    constructor(public bale: FilterBit) {}
}

export const UPDATE_FILTER = '[Filter action] Update Filter'
export class UpdateFilter implements Action {
    readonly type = UPDATE_FILTER
    constructor(public bale: FilterBit) {}
}

export const APPLY_SPECTRAL_FILTER = '[Filter action] Apply Spectral Filter'
export class ApplySpectralFilter implements Action {
    readonly type = APPLY_SPECTRAL_FILTER
    constructor(public bale: FilterBit) {}
}

export type Actions = InitFilter | UpdateFilter | ApplySpectralFilter
