import { Action } from '../99.core/interface/action.interface'
import ServiceBit from './fce/service.bit'

// Service actions

export const INIT_SERVICE = '[Service action] Init Service'
export class InitService implements Action {
    readonly type = INIT_SERVICE
    constructor(public bale: ServiceBit) {}
}

export const UPDATE_SERVICE = '[Service action] Update Service'
export class UpdateService implements Action {
    readonly type = UPDATE_SERVICE
    constructor(public bale: ServiceBit) {}
}

export type Actions = InitService | UpdateService
