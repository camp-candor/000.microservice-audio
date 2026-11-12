import clone from 'clone-deep'
import * as Act from './model.action.js'
import { ModelModel } from './model.model.js'
import * as Buzz from './model.buzzer.js'
import type State from '../99.core/state.js'

export function reducer(
    model: ModelModel = new ModelModel(),
    act: Act.Actions,
    state?: State,
): ModelModel | Promise<ModelModel> {
    switch (act.type) {
        case Act.INIT_MODEL:
            return Buzz.initModel(clone(model), act.bale, state)

        case Act.UPDATE_MODEL:
            return Buzz.updateModel(clone(model), act.bale, state)

        case Act.RESOLVE_LATENT_TENSOR:
            return Buzz.resolveLatentTensor(clone(model), act.bale, state)

        case Act.AUDIT_MEMORY_BUDGET:
            return Buzz.auditMemoryBudget(clone(model), act.bale, state)

        case Act.CONFIGURE_MMAP_ARGS:
            return Buzz.configureMmapArgs(clone(model), act.bale, state)

        default:
            return model
    }
}
