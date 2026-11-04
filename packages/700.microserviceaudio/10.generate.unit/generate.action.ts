import { Action } from '../99.core/interface/action.interface'
import GenerateBit from './fce/generate.bit'

// Generate actions

export const INIT_GENERATE = '[Generate action] Init Generate'
export class InitGenerate implements Action {
    readonly type = INIT_GENERATE
    constructor(public bale: GenerateBit) {}
}

export const UPDATE_GENERATE = '[Generate action] Update Generate'
export class UpdateGenerate implements Action {
    readonly type = UPDATE_GENERATE
    constructor(public bale: GenerateBit) {}
}

export type Actions = InitGenerate | UpdateGenerate
