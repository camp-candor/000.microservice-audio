import type { Action } from '../99.core/interface/action.interface.js'
import type ProfileBit from './fce/profile.bit.js'

export const INIT_PROFILE = '[Profile action] Init Profile'
export class InitProfile implements Action {
  readonly type = INIT_PROFILE
  constructor(public bale: ProfileBit) {}
}

export const UPDATE_PROFILE = '[Profile action] Update Profile'
export class UpdateProfile implements Action {
  readonly type = UPDATE_PROFILE
  constructor(public bale: ProfileBit) {}
}

export const RESOLVE_VOICE_PROFILE = '[Profile action] Resolve Voice Profile'
export class ResolveVoiceProfile implements Action {
  readonly type = RESOLVE_VOICE_PROFILE
  constructor(public bale: ProfileBit) {}
}

export const AUDIT_VAULT_BOUNDARY = '[Profile action] Audit Vault Boundary'
export class AuditVaultBoundary implements Action {
  readonly type = AUDIT_VAULT_BOUNDARY
  constructor(public bale: ProfileBit) {}
}

export type Actions =
  | InitProfile
  | UpdateProfile
  | ResolveVoiceProfile
  | AuditVaultBoundary
