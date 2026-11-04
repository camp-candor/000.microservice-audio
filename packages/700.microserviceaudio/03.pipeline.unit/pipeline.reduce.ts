import clone from 'clone-deep'
import * as Act from './pipeline.action'
import { PipelineModel } from './pipeline.model'
import * as Buzz from './pipeline.buzzer'
import State from '../99.core/state'

export function reducer(
    model: PipelineModel = new PipelineModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.UPDATE_PIPELINE:
            return Buzz.updatePipeline(clone(model), act.bale, state)

        case Act.INIT_PIPELINE:
            return Buzz.initPipeline(clone(model), act.bale, state)

        default:
            return model
    }
}
