import { Action } from '../99.core/interface/action.interface'
import FilterBit from './fce/filter.bit'

// Filter actions

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

export type Actions = InitFilter | UpdateFilter
