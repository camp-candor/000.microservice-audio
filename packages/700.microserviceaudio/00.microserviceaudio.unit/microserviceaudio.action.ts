import { Action } from '../99.core/interface/action.interface.js'
import MicroserviceaudioBit from './fce/microserviceaudio.bit.js'

// microserviceaudio actions

export const INIT_MICROSERVICEAUDIO =
    '[Microserviceaudio action] Init Microserviceaudio'
export class InitMicroserviceaudio implements Action {
    readonly type = INIT_MICROSERVICEAUDIO
    constructor(public bale: MicroserviceaudioBit) {}
}

export const UPDATE_MICROSERVICEAUDIO =
    '[Microserviceaudio action] Update Microserviceaudio'
export class UpdateMicroserviceaudio implements Action {
    readonly type = UPDATE_MICROSERVICEAUDIO
    constructor(public bale: MicroserviceaudioBit) {}
}

export const TEST_MICROSERVICEAUDIO = '[Test action] Test Microserviceaudio'
export class TestMicroserviceaudio implements Action {
    readonly type = TEST_MICROSERVICEAUDIO
    constructor(public bale: MicroserviceaudioBit) {}
}

export const INTELLECT_MICROSERVICEAUDIO =
    '[Intellect action] Intellect Microserviceaudio'
export class IntellectMicroserviceaudio implements Action {
    readonly type = INTELLECT_MICROSERVICEAUDIO
    constructor(public bale: MicroserviceaudioBit) {}
}

export const VISION_MICROSERVICEAUDIO =
    '[Vision action] Vision Microserviceaudio'
export class VisionMicroserviceaudio implements Action {
    readonly type = VISION_MICROSERVICEAUDIO
    constructor(public bale: MicroserviceaudioBit) {}
}

export const LIST_MICROSERVICEAUDIO = '[List action] List Microserviceaudio'
export class ListMicroserviceaudio implements Action {
    readonly type = LIST_MICROSERVICEAUDIO
    constructor(public bale: MicroserviceaudioBit) {}
}

export type Actions =
    | InitMicroserviceaudio
    | UpdateMicroserviceaudio
    | TestMicroserviceaudio
    | IntellectMicroserviceaudio
    | VisionMicroserviceaudio
    | ListMicroserviceaudio
