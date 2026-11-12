import type { Action } from '../99.core/interface/action.interface.js'
import type LoudnessBit from './fce/loudness.bit.js'

export const INIT_LOUDNESS = '[Loudness action] Init Loudness'
export class InitLoudness implements Action {
    readonly type = INIT_LOUDNESS
    constructor(public bale: LoudnessBit) {}
}

export const UPDATE_LOUDNESS = '[Loudness action] Update Loudness'
export class UpdateLoudness implements Action {
    readonly type = UPDATE_LOUDNESS
    constructor(public bale: LoudnessBit) {}
}

export const AUDIT_LOUDNESS = '[Loudness action] Audit Loudness'
export class AuditLoudness implements Action {
    readonly type = AUDIT_LOUDNESS
    constructor(public bale: LoudnessBit) {}
}

export const CALIBRATE_LOUDNESS_TWO_PASS =
    '[Loudness action] Calibrate Loudness Two Pass'
export class CalibrateLoudnessTwoPass implements Action {
    readonly type = CALIBRATE_LOUDNESS_TWO_PASS
    constructor(public bale: LoudnessBit) {}
}

export type Actions =
    InitLoudness | UpdateLoudness | AuditLoudness | CalibrateLoudnessTwoPass
