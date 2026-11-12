import clone from 'clone-deep'
import * as Act from './pipeline.action.js'
import { PipelineModel } from './pipeline.model.js'
import * as Buzz from './pipeline.buzzer.js'
import type State from '../99.core/state.js'

export function reducer(
    model: PipelineModel = new PipelineModel(),
    act: Act.Actions,
    state?: State,
): PipelineModel | Promise<PipelineModel> {
    switch (act.type) {
        case Act.INIT_PIPELINE:
            return Buzz.initPipeline(clone(model), act.bale, state)

        case Act.UPDATE_PIPELINE:
            return Buzz.updatePipeline(clone(model), act.bale, state)

        case Act.EXECUTE_SYNTHESIS_PIPELINE:
            return Buzz.executeSynthesisPipeline(clone(model), act.bale, state)

        default:
            return model
    }
}
