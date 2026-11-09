import clone from 'clone-deep'
import * as Act from './profile.action.js'
import { ProfileModel } from './profile.model.js'
import * as Buzz from './profile.buzzer.js'
import type State from '../99.core/state.js'

export function reducer(
  model: ProfileModel = new ProfileModel(),
  act: Act.Actions,
  state?: State,
): ProfileModel | Promise<ProfileModel> {
  switch (act.type) {
    case Act.INIT_PROFILE:
      return Buzz.initProfile(clone(model), act.bale, state)

    case Act.UPDATE_PROFILE:
      return Buzz.updateProfile(clone(model), act.bale, state)

    case Act.RESOLVE_VOICE_PROFILE:
      return Buzz.resolveVoiceProfile(clone(model), act.bale, state)

    case Act.AUDIT_VAULT_BOUNDARY:
      return Buzz.auditVaultBoundary(clone(model), act.bale, state)

    default:
      return model
  }
}
