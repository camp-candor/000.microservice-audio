import Model from './99.core/interface/model.interface'

import MicroserviceaudioUnit from './00.microserviceaudio.unit/microserviceaudio.unit'
import ModelUnit from './96.model.unit/model.unit'
import CollectUnit from './97.collect.unit/collect.unit'
import MenuUnit from './98.menu.unit/menu.unit'
import BusUnit from './99.bus.unit/bus.unit'
import GenerateUnit from './10.generate.unit/generate.unit.js'
import LoudnessUnit from './01.loudness.unit/loudness.unit.js'
import PeaksUnit from './02.peaks.unit/peaks.unit.js'
import TranscriptionUnit from './06.transcription.unit/transcription.unit.js'
import SchemasUnit from './08.schemas.unit/schemas.unit.js'
import FilterUnit from './11.filter.unit/filter.unit.js'
import DeesserUnit from './16.deesser.unit/deesser.unit.js'

import Microserviceaudio from './00.microserviceaudio.unit/fce/microserviceaudio.interface'
import { MicroserviceaudioModel } from './00.microserviceaudio.unit/microserviceaudio.model'
import ModelInterface from './96.model.unit/fce/model.interface'
import { ModelModel } from './96.model.unit/model.model'
import Collect from './97.collect.unit/fce/collect.interface'
import { CollectModel } from './97.collect.unit/collect.model'
import Menu from './98.menu.unit/fce/menu.interface'
import { MenuModel } from './98.menu.unit/menu.model'
import Bus from './99.bus.unit/fce/bus.interface'
import { BusModel } from './99.bus.unit/bus.model'
import Generate from './10.generate.unit/fce/generate.interface.js'
import { GenerateModel } from './10.generate.unit/generate.model.js'
import Loudness from './01.loudness.unit/fce/loudness.interface.js'
import { LoudnessModel } from './01.loudness.unit/loudness.model.js'
import Peaks from './02.peaks.unit/fce/peaks.interface.js'
import { PeaksModel } from './02.peaks.unit/peaks.model.js'
import Transcription from './06.transcription.unit/fce/transcription.interface.js'
import { TranscriptionModel } from './06.transcription.unit/transcription.model.js'
import Schemas from './08.schemas.unit/fce/schemas.interface.js'
import { SchemasModel } from './08.schemas.unit/schemas.model.js'
import Filter from './11.filter.unit/fce/filter.interface.js'
import { FilterModel } from './11.filter.unit/filter.model.js'
import Deesser from './16.deesser.unit/fce/deesser.interface.js'
import { DeesserModel } from './16.deesser.unit/deesser.model.js'

export const list: Array<any> = [
    MicroserviceaudioUnit,
    ModelUnit,
    CollectUnit,
    MenuUnit,
    BusUnit,
    GenerateUnit,
    LoudnessUnit,
    PeaksUnit,
    TranscriptionUnit,
    SchemasUnit,
    FilterUnit,
    DeesserUnit,
]

import * as reduceFromMicroserviceaudio from './00.microserviceaudio.unit/microserviceaudio.reduce'
import * as reduceFromModel from './96.model.unit/model.reduce'
import * as reduceFromCollect from './97.collect.unit/collect.reduce'
import * as reduceFromMenu from './98.menu.unit/menu.reduce'
import * as reduceFromBus from './99.bus.unit/bus.reduce'
import * as reduceFromGenerate from './10.generate.unit/generate.reduce.js'
import * as reduceFromLoudness from './01.loudness.unit/loudness.reduce.js'
import * as reduceFromPeaks from './02.peaks.unit/peaks.reduce.js'
import * as reduceFromTranscription from './06.transcription.unit/transcription.reduce.js'
import * as reduceFromSchemas from './08.schemas.unit/schemas.reduce.js'
import * as reduceFromFilter from './11.filter.unit/filter.reduce.js'
import * as reduceFromDeesser from './16.deesser.unit/deesser.reduce.js'

export const reducer: any = {
    microserviceaudio: reduceFromMicroserviceaudio.reducer,
    model: reduceFromModel.reducer,
    collect: reduceFromCollect.reducer,
    menu: reduceFromMenu.reducer,
    bus: reduceFromBus.reducer,
    generate: reduceFromGenerate.reducer,
    loudness: reduceFromLoudness.reducer,
    peaks: reduceFromPeaks.reducer,
    transcription: reduceFromTranscription.reducer,
    schemas: reduceFromSchemas.reducer,
    filter: reduceFromFilter.reducer,
    deesser: reduceFromDeesser.reducer,
}

export default class UnitData implements Model {
    microserviceaudio: Microserviceaudio = new MicroserviceaudioModel()
    model: ModelInterface = new ModelModel()
    collect: Collect = new CollectModel()
    menu: Menu = new MenuModel()
    bus: Bus = new BusModel()
    generate: Generate = new GenerateModel()
    loudness: Loudness = new LoudnessModel()
    peaks: Peaks = new PeaksModel()
    transcription: Transcription = new TranscriptionModel()
    schemas: Schemas = new SchemasModel()
    filter: Filter = new FilterModel()
    deesser: Deesser = new DeesserModel()
}
