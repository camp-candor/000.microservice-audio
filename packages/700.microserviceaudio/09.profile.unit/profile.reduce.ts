import clone from 'clone-deep'
import * as Act from './profile.action'
import { ProfileModel } from './profile.model'
import * as Buzz from './profile.buzzer'
import State from '../99.core/state'

export function reducer(
    model: ProfileModel = new ProfileModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.UPDATE_PROFILE:
            return Buzz.updateProfile(clone(model), act.bale, state)

        case Act.INIT_PROFILE:
            return Buzz.initProfile(clone(model), act.bale, state)

        default:
            return model
    }
}
