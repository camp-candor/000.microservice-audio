import { AcousticModel } from '../acoustic.model.js';
import AcousticBit, {
  AcousticCalculationInput,
  AcousticDspModifiers,
} from '../fce/acoustic.bit.js';
import State from '../../99.core/state.js';

const UPDATE_CONSOLE = '[Console action] Update Console';

const logConsole = async (src: string): Promise<void> => {
  if ((globalThis as any).LIBRARY?.hunt) {
    await (globalThis as any).LIBRARY.hunt(UPDATE_CONSOLE, {
      idx: 'cns00',
      src,
    });
  }
};

export const initAcoustic = (
  cpy: AcousticModel,
  bal: AcousticBit,
  ste: State,
): AcousticModel => {
  cpy.modulationsResolved = 0;
  cpy.acousticBits = {};
  if (bal.slv) bal.slv({ acsBit: { idx: 'init-acoustic', val: 1 } });
  return cpy;
};

export const updateAcoustic = (
  cpy: AcousticModel,
  bal: AcousticBit,
  ste: State,
): AcousticModel => {
  if (bal.idx) cpy.acousticBits[bal.idx] = bal;
  if (bal.slv) bal.slv({ acsBit: bal });
  return cpy;
};

export const calculateSomaticDspModifiers = (
  input: AcousticCalculationInput,
): AcousticDspModifiers => {
  const conditions = (input.activeConditions || []).map((c) => c.toLowerCase());
  const fatigueBps = Math.max(0, Math.min(10000, input.meters?.somaticFatigueBps ?? 0));
  const painBps = Math.max(0, Math.min(10000, input.meters?.physicalPainBps ?? 0));

  const basePitch = input.basePitchShift ?? 0.0;
  const baseFormant = input.baseFormant ?? 1.0;
  const baseBreath = input.baseBreathiness ?? 1.0;
  const baseFry = input.baseVocalFry ?? 0.0;
  const basePacing = input.basePacing ?? 1.0;

  const bannedCadences: string[] = [];

  // 1. Fundamental Frequency Transposition
  let pitchShift =
    basePitch +
    3.5 * (painBps / 10000) +
    -2.0 * (fatigueBps / 10000);

  // 2. Formant Warping Factor
  let formantWarp = baseFormant;
  if (conditions.includes('cnd_crushed_laryngeal_cartilage') || conditions.includes('crushed_larynx')) {
    formantWarp = 0.7;
    pitchShift -= 4.0;
    bannedCadences.push('RISING_INFLECTION');
  }

  // Cold shock elevation
  if (conditions.includes('cnd_severe_hypothermia')) {
    pitchShift += 2.5;
    bannedCadences.push('MONOTONE_FLAT');
  }

  pitchShift = Math.max(-12.0, Math.min(12.0, Math.round(pitchShift * 10) / 10));
  formantWarp = Math.max(0.5, Math.min(2.0, Math.round(formantWarp * 100) / 100));

  // 3. Breath Interval Dilation (Quadratic)
  const fatigueRatio = fatigueBps / 10000;
  let breathiness = baseBreath * (1.0 + 1.4 * Math.pow(fatigueRatio, 2));
  breathiness = Math.max(1.0, Math.min(3.5, Math.round(breathiness * 100) / 100));

  // 4. Pause Frequency Multiplier & Pacing Deceleration
  let pauseMultiplier = 1.0;
  let tonePacing = basePacing * (1.0 - 0.3 * fatigueRatio);

  if (fatigueBps > 8000) {
    pauseMultiplier = 2.8;
    bannedCadences.push('RAPID_STACCATO');
  }

  // 5. Subharmonic Vocal Fry Density
  let vocalFry = baseFry + 0.5 * fatigueRatio + 0.4 * (painBps / 10000);
  if (conditions.includes('cnd_severe_hypothermia')) {
    vocalFry = Math.max(vocalFry, 0.8);
  }
  vocalFry = Math.max(0.0, Math.min(1.0, Math.round(vocalFry * 100) / 100));

  return {
    basePitchShiftSemitones: pitchShift,
    formantWarpingFactor: formantWarp,
    breathinessPauseMultiplier: breathiness,
    pause_frequency_multiplier: pauseMultiplier,
    vocalFryDensity: vocalFry,
    tonePacing: Math.round(tonePacing * 1000) / 1000,
    bannedCadences,
  };
};

export const resolveDspModifiers = async (
  cpy: AcousticModel,
  bal: AcousticBit,
  ste: State,
): Promise<AcousticModel> => {
  const dat = bal.dat;
  if (!dat?.characterId) {
    if (bal.slv) {
      bal.slv({
        acsBit: {
          idx: bal.idx,
          result: {
            basePitchShiftSemitones: 0,
            formantWarpingFactor: 1.0,
            breathinessPauseMultiplier: 1.0,
            pause_frequency_multiplier: 1.0,
            vocalFryDensity: 0.0,
            tonePacing: 1.0,
            bannedCadences: [],
          },
        },
      });
    }
    return cpy;
  }

  const modifiers = calculateSomaticDspModifiers(dat);
  bal.result = modifiers;

  await logConsole(
    `>> [OK] [DSP] Formant: ${modifiers.formantWarpingFactor}, Pitch: ${modifiers.basePitchShiftSemitones}st, Breath: ${modifiers.breathinessPauseMultiplier}x`,
  );

  cpy.modulationsResolved += 1;
  if (bal.slv) bal.slv({ acsBit: bal });
  return cpy;
};
