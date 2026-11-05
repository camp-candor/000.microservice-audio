import clone from 'clone-deep';
import * as Act from './generate.action.js';
import { GenerateModel } from './generate.model.js';
import * as Buzz from './generate.buzzer.js';
import State from '../99.core/state.js';

export function reducer(
  model: GenerateModel = new GenerateModel(),
  act: Act.Actions,
  state?: State,
) {
  switch (act.type) {
    case Act.INIT_GENERATE:
      return Buzz.initGenerate(clone(model), act.bale, state!);
    case Act.UPDATE_GENERATE:
      return Buzz.updateGenerate(clone(model), act.bale, state!);
    case Act.EXEC_GENERATE:
      return Buzz.execGenerate(clone(model), act.bale, state!);
    case Act.END_GENERATE:
      return Buzz.endGenerate(clone(model), act.bale, state!);
    default:
      return model;
  }
}
