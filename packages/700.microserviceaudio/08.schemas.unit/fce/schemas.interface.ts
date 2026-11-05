import type SchemasBit from './schemas.bit.js'

export default interface Schemas {
    idx: string
    validationsCompleted: number
    schemasBits: Record<string, SchemasBit>
}
