import { Action } from '../99.core/interface/action.interface'
import PipelineBit from './fce/pipeline.bit'

// Pipeline actions

export const INIT_PIPELINE = '[Pipeline action] Init Pipeline'
export class InitPipeline implements Action {
    readonly type = INIT_PIPELINE
    constructor(public bale: PipelineBit) {}
}

export const UPDATE_PIPELINE = '[Pipeline action] Update Pipeline'
export class UpdatePipeline implements Action {
    readonly type = UPDATE_PIPELINE
    constructor(public bale: PipelineBit) {}
}

export type Actions = InitPipeline | UpdatePipeline
