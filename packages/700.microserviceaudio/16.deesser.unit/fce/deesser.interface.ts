import type DeesserBit from './deesser.bit.js'

export default interface Deesser {
    idx: string
    filesProcessed: number
    deesserBits: Record<string, DeesserBit>
}
