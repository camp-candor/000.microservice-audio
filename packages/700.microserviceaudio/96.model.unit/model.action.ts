import type { Action } from '../99.core/interface/action.interface.js'
import type ModelBit from './fce/model.bit.js'

export const INIT_MODEL = '[Model action] Init Model'
export class InitModel implements Action {
  readonly type = INIT_MODEL
  constructor(public bale: ModelBit) {}
}

export const UPDATE_MODEL = '[Model action] Update Model'
export class UpdateModel implements Action {
  readonly type = UPDATE_MODEL
  constructor(public bale: ModelBit) {}
}

export const RESOLVE_LATENT_TENSOR = '[Model action] Resolve Latent Tensor'
export class ResolveLatentTensor implements Action {
  readonly type = RESOLVE_LATENT_TENSOR
  constructor(public bale: ModelBit) {}
}

export const AUDIT_MEMORY_BUDGET = '[Model action] Audit Memory Budget'
export class AuditMemoryBudget implements Action {
  readonly type = AUDIT_MEMORY_BUDGET
  constructor(public bale: ModelBit) {}
}

export const CONFIGURE_MMAP_ARGS = '[Model action] Configure Mmap Args'
export class ConfigureMmapArgs implements Action {
  readonly type = CONFIGURE_MMAP_ARGS
  constructor(public bale: ModelBit) {}
}

export type Actions =
  | InitModel
  | UpdateModel
  | ResolveLatentTensor
  | AuditMemoryBudget
  | ConfigureMmapArgs
