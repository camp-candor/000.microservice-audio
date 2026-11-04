import { Action } from '../99.core/interface/action.interface'
import ProfileBit from './fce/profile.bit'

// Profile actions

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

export type Actions = InitProfile | UpdateProfile
