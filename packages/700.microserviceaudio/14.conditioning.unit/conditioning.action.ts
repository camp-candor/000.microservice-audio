import { Action } from '../99.core/interface/action.interface.js';
import ConditioningBit from './fce/conditioning.bit.js';

export const INIT_CONDITIONING = '[Conditioning action] Init Conditioning';
export class InitConditioning implements Action {
  readonly type = INIT_CONDITIONING;
  constructor(public bale: ConditioningBit) {}
}

export const UPDATE_CONDITIONING = '[Conditioning action] Update Conditioning';
export class UpdateConditioning implements Action {
  readonly type = UPDATE_CONDITIONING;
  constructor(public bale: ConditioningBit) {}
}

export const VALIDATE_PHONATION = '[Conditioning action] Validate Phonation';
export class ValidatePhonation implements Action {
  readonly type = VALIDATE_PHONATION;
  constructor(public bale: ConditioningBit) {}
}

export type Actions = InitConditioning | UpdateConditioning | ValidatePhonation;
