import { Action } from '../99.core/interface/action.interface.js';
import AcousticBit from './fce/acoustic.bit.js';

export const INIT_ACOUSTIC = '[Acoustic action] Init Acoustic';
export class InitAcoustic implements Action {
  readonly type = INIT_ACOUSTIC;
  constructor(public bale: AcousticBit) {}
}

export const UPDATE_ACOUSTIC = '[Acoustic action] Update Acoustic';
export class UpdateAcoustic implements Action {
  readonly type = UPDATE_ACOUSTIC;
  constructor(public bale: AcousticBit) {}
}

export const RESOLVE_DSP_MODIFIERS = '[Acoustic action] Resolve Dsp Modifiers';
export class ResolveDspModifiers implements Action {
  readonly type = RESOLVE_DSP_MODIFIERS;
  constructor(public bale: AcousticBit) {}
}

export type Actions = InitAcoustic | UpdateAcoustic | ResolveDspModifiers;
