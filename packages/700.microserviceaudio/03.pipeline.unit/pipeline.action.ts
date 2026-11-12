import type { Action } from '../99.core/interface/action.interface.js'
import type PipelineBit from './fce/pipeline.bit.js'

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

export const EXECUTE_SYNTHESIS_PIPELINE =
    '[Pipeline action] Execute Synthesis Pipeline'
export class ExecuteSynthesisPipeline implements Action {
    readonly type = EXECUTE_SYNTHESIS_PIPELINE
    constructor(public bale: PipelineBit) {}
}

export type Actions = InitPipeline | UpdatePipeline | ExecuteSynthesisPipeline
