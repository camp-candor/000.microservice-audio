import Model from './99.core/interface/model.interface'

import MicroserviceaudioUnit from './00.microserviceaudio.unit/microserviceaudio.unit'
import ModelUnit from './96.model.unit/model.unit'
import CollectUnit from './97.collect.unit/collect.unit'
import MenuUnit from './98.menu.unit/menu.unit'
import BusUnit from './99.bus.unit/bus.unit'

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

export const list: Array<any> = [
    MicroserviceaudioUnit,
    ModelUnit,
    CollectUnit,
    MenuUnit,
    BusUnit,
]

import * as reduceFromMicroserviceaudio from './00.microserviceaudio.unit/microserviceaudio.reduce'
import * as reduceFromModel from './96.model.unit/model.reduce'
import * as reduceFromCollect from './97.collect.unit/collect.reduce'
import * as reduceFromMenu from './98.menu.unit/menu.reduce'
import * as reduceFromBus from './99.bus.unit/bus.reduce'

export const reducer: any = {
    microserviceaudio: reduceFromMicroserviceaudio.reducer,
    model: reduceFromModel.reducer,
    collect: reduceFromCollect.reducer,
    menu: reduceFromMenu.reducer,
    bus: reduceFromBus.reducer,
}

export default class UnitData implements Model {
    microserviceaudio: Microserviceaudio = new MicroserviceaudioModel()
    model: ModelInterface = new ModelModel()
    collect: Collect = new CollectModel()
    menu: Menu = new MenuModel()
    bus: Bus = new BusModel()
}
