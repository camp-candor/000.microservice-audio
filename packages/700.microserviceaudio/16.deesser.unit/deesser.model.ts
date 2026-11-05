import type Deesser from './fce/deesser.interface.js'
import type DeesserBit from './fce/deesser.bit.js'

export class DeesserModel implements Deesser {
    idx: string = '16.deesser'
    filesProcessed: number = 0
    deesserBits: Record<string, DeesserBit> = {}
}
