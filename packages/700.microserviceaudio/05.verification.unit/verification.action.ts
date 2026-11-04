import { Action } from '../99.core/interface/action.interface'
import VerificationBit from './fce/verification.bit'

// Verification actions

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

export type Actions = InitVerification | UpdateVerification
