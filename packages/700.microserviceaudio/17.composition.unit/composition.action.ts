import type { Action } from '../99.core/interface/action.interface.js'
import type CompositionBit from './fce/composition.bit.js'

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

export const BUILD_VISEME_SIDECAR = '[Composition action] Build Viseme Sidecar'
export class BuildVisemeSidecar implements Action {
    readonly type = BUILD_VISEME_SIDECAR
    constructor(public bale: CompositionBit) {}
}

export type Actions = InitComposition | UpdateComposition | BuildVisemeSidecar
