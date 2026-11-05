import type Schemas from './fce/schemas.interface.js'
import type SchemasBit from './fce/schemas.bit.js'

export class SchemasModel implements Schemas {
    idx: string = '08.schemas'
    validationsCompleted: number = 0
    schemasBits: Record<string, SchemasBit> = {}
}
