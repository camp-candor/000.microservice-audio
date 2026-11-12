import type { Action } from '../99.core/interface/action.interface.js'
import type AudioBit from './fce/audio.bit.js'

export const INIT_AUDIO = '[Audio action] Init Audio'
export class InitAudio implements Action {
    readonly type = INIT_AUDIO
    constructor(public bale: AudioBit) {}
}

export const UPDATE_AUDIO = '[Audio action] Update Audio'
export class UpdateAudio implements Action {
    readonly type = UPDATE_AUDIO
    constructor(public bale: AudioBit) {}
}

export const FLATTEN_PITCH_WSOLA = '[Audio action] Flatten Pitch Wsola'
export class FlattenPitchWsola implements Action {
    readonly type = FLATTEN_PITCH_WSOLA
    constructor(public bale: AudioBit) {}
}

export const FLATTEN_FORMANTS_LPC = '[Audio action] Flatten Formants Lpc'
export class FlattenFormantsLpc implements Action {
    readonly type = FLATTEN_FORMANTS_LPC
    constructor(public bale: AudioBit) {}
}

export const AUDIT_UNVOICED_NOISE_FLOOR =
    '[Audio action] Audit Unvoiced Noise Floor'
export class AuditUnvoicedNoiseFloor implements Action {
    readonly type = AUDIT_UNVOICED_NOISE_FLOOR
    constructor(public bale: AudioBit) {}
}

export const EXECUTE_SPECTRAL_INVERSION =
    '[Audio action] Execute Spectral Inversion'
export class ExecuteSpectralInversion implements Action {
    readonly type = EXECUTE_SPECTRAL_INVERSION
    constructor(public bale: AudioBit) {}
}

export const MEASURE_CADENCE_SIGNATURE =
    '[Audio action] Measure Cadence Signature'
export class MeasureCadenceSignature implements Action {
    readonly type = MEASURE_CADENCE_SIGNATURE
    constructor(public bale: AudioBit) {}
}

export const CLASSIFY_CHARACTER_CADENCE =
    '[Audio action] Classify Character Cadence'
export class ClassifyCharacterCadence implements Action {
    readonly type = CLASSIFY_CHARACTER_CADENCE
    constructor(public bale: AudioBit) {}
}

export type Actions =
    | InitAudio
    | UpdateAudio
    | FlattenPitchWsola
    | FlattenFormantsLpc
    | AuditUnvoicedNoiseFloor
    | ExecuteSpectralInversion
    | MeasureCadenceSignature
    | ClassifyCharacterCadence
