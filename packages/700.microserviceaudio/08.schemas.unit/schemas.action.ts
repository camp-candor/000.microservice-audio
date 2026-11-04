import { Action } from '../99.core/interface/action.interface'
import SchemasBit from './fce/schemas.bit'

// Schemas actions

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

export type Actions = InitSchemas | UpdateSchemas
