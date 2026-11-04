import { Action } from '../99.core/interface/action.interface'
import CompositionBit from './fce/composition.bit'

// Composition actions

export const INIT_COMPOSITION = '[Composition action] Init Composition'
export class InitComposition implements Action {
    readonly type = INIT_COMPOSITION
    constructor(public bale: CompositionBit) {}
}

export const UPDATE_COMPOSITION = '[Composition action] Update Composition'
export class UpdateComposition implements Action {
    readonly type = UPDATE_COMPOSITION
    constructor(public bale: CompositionBit) {}
}

export type Actions = InitComposition | UpdateComposition
