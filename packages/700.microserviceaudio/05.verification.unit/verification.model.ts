import type Verification from './fce/verification.interface.js'
import type { VerificationReport } from './fce/verification.interface.js'
import type VerificationBit from './fce/verification.bit.js'

export class VerificationModel implements Verification {
    idx: string = '05.verification'
    auditsCompleted: number = 0
    stemsPassedCount: number = 0
    stemsQuarantinedCount: number = 0
    lastReport: VerificationReport | null = null
    verificationBits: Record<string, VerificationBit> = {}
}
