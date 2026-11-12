import type Model from './99.core/interface/model.interface.js'

import MicroserviceaudioUnit from './00.microserviceaudio.unit/microserviceaudio.unit.js'
import LoudnessUnit from './01.loudness.unit/loudness.unit.js'
import PeaksUnit from './02.peaks.unit/peaks.unit.js'
import PipelineUnit from './03.pipeline.unit/pipeline.unit.js'
import IntegrationUnit from './04.integration.unit/integration.unit.js'
import VerificationUnit from './05.verification.unit/verification.unit.js'
import TranscriptionUnit from './06.transcription.unit/transcription.unit.js'
import ServiceUnit from './07.service.unit/service.unit.js'
import SchemasUnit from './08.schemas.unit/schemas.unit.js'
import ProfileUnit from './09.profile.unit/profile.unit.js'
import GenerateUnit from './10.generate.unit/generate.unit.js'
import FilterUnit from './11.filter.unit/filter.unit.js'
import AcousticUnit from './12.acoustic.unit/acoustic.unit.js'
import AudioUnit from './13.audio.unit/audio.unit.js'
import ConditioningUnit from './14.conditioning.unit/conditioning.unit.js'
import DialogueUnit from './15.dialogue.unit/dialogue.unit.js'
import DeesserUnit from './16.deesser.unit/deesser.unit.js'
import CompositionUnit from './17.composition.unit/composition.unit.js'
import ModelUnit from './96.model.unit/model.unit.js'
import CollectUnit from './97.collect.unit/collect.unit.js'
import MenuUnit from './98.menu.unit/menu.unit.js'
import BusUnit from './99.bus.unit/bus.unit.js'

import type Microserviceaudio from './00.microserviceaudio.unit/fce/microserviceaudio.interface.js'
import { MicroserviceaudioModel } from './00.microserviceaudio.unit/microserviceaudio.model.js'
import type Loudness from './01.loudness.unit/fce/loudness.interface.js'
import { LoudnessModel } from './01.loudness.unit/loudness.model.js'
import type Peaks from './02.peaks.unit/fce/peaks.interface.js'
import { PeaksModel } from './02.peaks.unit/peaks.model.js'
import type Pipeline from './03.pipeline.unit/fce/pipeline.interface.js'
import { PipelineModel } from './03.pipeline.unit/pipeline.model.js'
import type Integration from './04.integration.unit/fce/integration.interface.js'
import { IntegrationModel } from './04.integration.unit/integration.model.js'
import type Verification from './05.verification.unit/fce/verification.interface.js'
import { VerificationModel } from './05.verification.unit/verification.model.js'
import type Transcription from './06.transcription.unit/fce/transcription.interface.js'
import { TranscriptionModel } from './06.transcription.unit/transcription.model.js'
import type Service from './07.service.unit/fce/service.interface.js'
import { ServiceModel } from './07.service.unit/service.model.js'
import type Schemas from './08.schemas.unit/fce/schemas.interface.js'
import { SchemasModel } from './08.schemas.unit/schemas.model.js'
import type Profile from './09.profile.unit/fce/profile.interface.js'
import { ProfileModel } from './09.profile.unit/profile.model.js'
import type Generate from './10.generate.unit/fce/generate.interface.js'
import { GenerateModel } from './10.generate.unit/generate.model.js'
import type Filter from './11.filter.unit/fce/filter.interface.js'
import { FilterModel } from './11.filter.unit/filter.model.js'
import type Acoustic from './12.acoustic.unit/fce/acoustic.interface.js'
import { AcousticModel } from './12.acoustic.unit/acoustic.model.js'
import type Audio from './13.audio.unit/fce/audio.interface.js'
import { AudioModel } from './13.audio.unit/audio.model.js'
import type Conditioning from './14.conditioning.unit/fce/conditioning.interface.js'
import { ConditioningModel } from './14.conditioning.unit/conditioning.model.js'
import type Dialogue from './15.dialogue.unit/fce/dialogue.interface.js'
import { DialogueModel } from './15.dialogue.unit/dialogue.model.js'
import type Deesser from './16.deesser.unit/fce/deesser.interface.js'
import { DeesserModel } from './16.deesser.unit/deesser.model.js'
import type Composition from './17.composition.unit/fce/composition.interface.js'
import { CompositionModel } from './17.composition.unit/composition.model.js'
import type ModelInterface from './96.model.unit/fce/model.interface.js'
import { ModelModel } from './96.model.unit/model.model.js'
import type Collect from './97.collect.unit/fce/collect.interface.js'
import { CollectModel } from './97.collect.unit/collect.model.js'
import type Menu from './98.menu.unit/fce/menu.interface.js'
import { MenuModel } from './98.menu.unit/menu.model.js'
import type Bus from './99.bus.unit/fce/bus.interface.js'
import { BusModel } from './99.bus.unit/bus.model.js'

export const list: Array<any> = [
    MicroserviceaudioUnit,
    LoudnessUnit,
    PeaksUnit,
    PipelineUnit,
    IntegrationUnit,
    VerificationUnit,
    TranscriptionUnit,
    ServiceUnit,
    SchemasUnit,
    ProfileUnit,
    GenerateUnit,
    FilterUnit,
    AcousticUnit,
    AudioUnit,
    ConditioningUnit,
    DialogueUnit,
    DeesserUnit,
    CompositionUnit,
    ModelUnit,
    CollectUnit,
    MenuUnit,
    BusUnit,
]

import * as reduceFromMicroserviceaudio from './00.microserviceaudio.unit/microserviceaudio.reduce.js'
import * as reduceFromLoudness from './01.loudness.unit/loudness.reduce.js'
import * as reduceFromPeaks from './02.peaks.unit/peaks.reduce.js'
import * as reduceFromPipeline from './03.pipeline.unit/pipeline.reduce.js'
import * as reduceFromIntegration from './04.integration.unit/integration.reduce.js'
import * as reduceFromVerification from './05.verification.unit/verification.reduce.js'
import * as reduceFromTranscription from './06.transcription.unit/transcription.reduce.js'
import * as reduceFromService from './07.service.unit/service.reduce.js'
import * as reduceFromSchemas from './08.schemas.unit/schemas.reduce.js'
import * as reduceFromProfile from './09.profile.unit/profile.reduce.js'
import * as reduceFromGenerate from './10.generate.unit/generate.reduce.js'
import * as reduceFromFilter from './11.filter.unit/filter.reduce.js'
import * as reduceFromAcoustic from './12.acoustic.unit/acoustic.reduce.js'
import * as reduceFromAudio from './13.audio.unit/audio.reduce.js'
import * as reduceFromConditioning from './14.conditioning.unit/conditioning.reduce.js'
import * as reduceFromDialogue from './15.dialogue.unit/dialogue.reduce.js'
import * as reduceFromDeesser from './16.deesser.unit/deesser.reduce.js'
import * as reduceFromComposition from './17.composition.unit/composition.reduce.js'
import * as reduceFromModel from './96.model.unit/model.reduce.js'
import * as reduceFromCollect from './97.collect.unit/collect.reduce.js'
import * as reduceFromMenu from './98.menu.unit/menu.reduce.js'
import * as reduceFromBus from './99.bus.unit/bus.reduce.js'

export const reducer: any = {
    microserviceaudio: reduceFromMicroserviceaudio.reducer,
    loudness: reduceFromLoudness.reducer,
    peaks: reduceFromPeaks.reducer,
    pipeline: reduceFromPipeline.reducer,
    integration: reduceFromIntegration.reducer,
    verification: reduceFromVerification.reducer,
    transcription: reduceFromTranscription.reducer,
    service: reduceFromService.reducer,
    schemas: reduceFromSchemas.reducer,
    profile: reduceFromProfile.reducer,
    generate: reduceFromGenerate.reducer,
    filter: reduceFromFilter.reducer,
    acoustic: reduceFromAcoustic.reducer,
    audio: reduceFromAudio.reducer,
    conditioning: reduceFromConditioning.reducer,
    dialogue: reduceFromDialogue.reducer,
    deesser: reduceFromDeesser.reducer,
    composition: reduceFromComposition.reducer,
    model: reduceFromModel.reducer,
    collect: reduceFromCollect.reducer,
    menu: reduceFromMenu.reducer,
    bus: reduceFromBus.reducer,
}

export default class UnitData implements Model {
    microserviceaudio: Microserviceaudio = new MicroserviceaudioModel()
    loudness: Loudness = new LoudnessModel()
    peaks: Peaks = new PeaksModel()
    pipeline: Pipeline = new PipelineModel()
    integration: Integration = new IntegrationModel()
    verification: Verification = new VerificationModel()
    transcription: Transcription = new TranscriptionModel()
    service: Service = new ServiceModel()
    schemas: Schemas = new SchemasModel()
    profile: Profile = new ProfileModel()
    generate: Generate = new GenerateModel()
    filter: Filter = new FilterModel()
    acoustic: Acoustic = new AcousticModel()
    audio: Audio = new AudioModel()
    conditioning: Conditioning = new ConditioningModel()
    dialogue: Dialogue = new DialogueModel()
    deesser: Deesser = new DeesserModel()
    composition: Composition = new CompositionModel()
    model: ModelInterface = new ModelModel()
    collect: Collect = new CollectModel()
    menu: Menu = new MenuModel()
    bus: Bus = new BusModel()
}
