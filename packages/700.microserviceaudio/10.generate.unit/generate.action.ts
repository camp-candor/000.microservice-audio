import { Action } from '../99.core/interface/action.interface.js';
import GenerateBit from './fce/generate.bit.js';

export const INIT_GENERATE = '[Generate action] Init Generate';
export class InitGenerate implements Action {
  readonly type = INIT_GENERATE;
  constructor(public bale: GenerateBit) {}
}

export const UPDATE_GENERATE = '[Generate action] Update Generate';
export class UpdateGenerate implements Action {
  readonly type = UPDATE_GENERATE;
  constructor(public bale: GenerateBit) {}
}

export const EXEC_GENERATE = '[Generate action] Exec Generate';
export class ExecGenerate implements Action {
  readonly type = EXEC_GENERATE;
  constructor(public bale: GenerateBit) {}
}

export const POLL_FILE_STABILIZATION = '[Generate action] Poll File Stabilization';
export class PollFileStabilization implements Action {
  readonly type = POLL_FILE_STABILIZATION;
  constructor(public bale: GenerateBit) {}
}

export type Actions = InitGenerate | UpdateGenerate | ExecGenerate | PollFileStabilization;
