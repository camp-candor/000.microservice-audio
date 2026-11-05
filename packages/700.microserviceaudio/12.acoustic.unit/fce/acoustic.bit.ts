import type { SomaticMeters } from '../../14.conditioning.unit/fce/conditioning.bit.js';

export interface AcousticDspModifiers {
  basePitchShiftSemitones: number;
  formantWarpingFactor: number;
  breathinessPauseMultiplier: number;
  pause_frequency_multiplier: number;
  vocalFryDensity: number;
  tonePacing: number;
  bannedCadences: string[];
}

export interface AcousticCalculationInput {
  characterId: string;
  meters?: SomaticMeters;
  activeConditions?: string[];
  basePitchShift?: number;
  baseFormant?: number;
  baseBreathiness?: number;
  baseVocalFry?: number;
  basePacing?: number;
}

export default interface AcousticBit {
  idx: string;
  src?: string;
  val?: number;
  dat?: AcousticCalculationInput;
  result?: AcousticDspModifiers;
  slv?: (result: { acsBit: AcousticBit }) => void;
}
