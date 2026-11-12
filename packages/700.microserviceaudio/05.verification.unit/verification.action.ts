import type { Action } from '../99.core/interface/action.interface.js'
import type VerificationBit from './fce/verification.bit.js'

export const INIT_VERIFICATION = '[Verification action] Init Verification'
export class InitVerification implements Action {
    readonly type = INIT_VERIFICATION
    constructor(public bale: VerificationBit) {}
}

export const UPDATE_VERIFICATION = '[Verification action] Update Verification'
export class UpdateVerification implements Action {
    readonly type = UPDATE_VERIFICATION
    constructor(public bale: VerificationBit) {}
}

export const RUN_CONFORMANCE_FIREWALL =
    '[Verification action] Run Conformance Firewall'
export class RunConformanceFirewall implements Action {
    readonly type = RUN_CONFORMANCE_FIREWALL
    constructor(public bale: VerificationBit) {}
}

export type Actions =
    InitVerification | UpdateVerification | RunConformanceFirewall
