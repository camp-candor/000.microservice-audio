import { Action } from '../99.core/interface/action.interface.js'
import SchemasBit from './fce/schemas.bit.js'

export const INIT_SCHEMAS = '[Schemas action] Init Schemas'
export class InitSchemas implements Action {
    readonly type = INIT_SCHEMAS
    constructor(public bale: SchemasBit) {}
}

export const UPDATE_SCHEMAS = '[Schemas action] Update Schemas'
export class UpdateSchemas implements Action {
    readonly type = UPDATE_SCHEMAS
    constructor(public bale: SchemasBit) {}
}

export const VALIDATE_INGRESS_CONTRACT =
    '[Schemas action] Validate Ingress Contract'
export class ValidateIngressContract implements Action {
    readonly type = VALIDATE_INGRESS_CONTRACT
    constructor(public bale: SchemasBit) {}
}

export const VALIDATE_SCRIPT_PARITY = '[Schemas action] Validate Script Parity'
export class ValidateScriptParity implements Action {
    readonly type = VALIDATE_SCRIPT_PARITY
    constructor(public bale: SchemasBit) {}
}

export type Actions =
    InitSchemas | UpdateSchemas | ValidateIngressContract | ValidateScriptParity
