import clone from 'clone-deep'
import * as Act from './audio.action.js'
import { AudioModel } from './audio.model.js'
import * as Buzz from './audio.buzzer.js'
import type State from '../99.core/state.js'

export function reducer(
  model: AudioModel = new AudioModel(),
  act: Act.Actions,
  state?: State,
): AudioModel | Promise<AudioModel> {
  switch (act.type) {
    case Act.INIT_AUDIO:
      return Buzz.initAudio(clone(model), act.bale, state)

    case Act.UPDATE_AUDIO:
      return Buzz.updateAudio(clone(model), act.bale, state)

    case Act.EXECUTE_SPECTRAL_INVERSION:
      return Buzz.executeSpectralInversion(clone(model), act.bale, state)

    default:
      return model
  }
}
