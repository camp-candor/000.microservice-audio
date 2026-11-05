import clone from 'clone-deep'
import * as Act from './schemas.action.js'
import { SchemasModel } from './schemas.model.js'
import * as Buzz from './schemas.buzzer.js'
import State from '../99.core/state.js'

export function reducer(
    model: SchemasModel = new SchemasModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.INIT_SCHEMAS:
            return Buzz.initSchemas(clone(model), act.bale, state!)
        case Act.UPDATE_SCHEMAS:
            return Buzz.updateSchemas(clone(model), act.bale, state!)
        case Act.VALIDATE_INGRESS_CONTRACT:
            return Buzz.validateIngressContract(clone(model), act.bale, state!)
        case Act.VALIDATE_SCRIPT_PARITY:
            return Buzz.validateScriptParity(clone(model), act.bale, state!)
        default:
            return model
    }
}
