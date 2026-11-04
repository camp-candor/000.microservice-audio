import clone from 'clone-deep'
import * as Act from './schemas.action'
import { SchemasModel } from './schemas.model'
import * as Buzz from './schemas.buzzer'
import State from '../99.core/state'

export function reducer(
    model: SchemasModel = new SchemasModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.UPDATE_SCHEMAS:
            return Buzz.updateSchemas(clone(model), act.bale, state)

        case Act.INIT_SCHEMAS:
            return Buzz.initSchemas(clone(model), act.bale, state)

        default:
            return model
    }
}
