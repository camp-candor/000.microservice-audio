import type { Action } from '../99.core/interface/action.interface.js'
import type BusBit from './fce/bus.bit.js'

export const INIT_BUS = '[Bus action] Init Bus'
export class InitBus implements Action {
    readonly type = INIT_BUS
    constructor(public bale: BusBit) {}
}

export const UPDATE_BUS = '[Bus action] Update Bus'
export class UpdateBus implements Action {
    readonly type = UPDATE_BUS
    constructor(public bale: BusBit) {}
}

export const EMIT_ASCII_TELEMETRY = '[Bus action] Emit Ascii Telemetry'
export class EmitAsciiTelemetry implements Action {
    readonly type = EMIT_ASCII_TELEMETRY
    constructor(public bale: BusBit) {}
}

export const FLUSH_BUS_RING = '[Bus action] Flush Bus Ring'
export class FlushBusRing implements Action {
    readonly type = FLUSH_BUS_RING
    constructor(public bale: BusBit) {}
}

export type Actions = InitBus | UpdateBus | EmitAsciiTelemetry | FlushBusRing
