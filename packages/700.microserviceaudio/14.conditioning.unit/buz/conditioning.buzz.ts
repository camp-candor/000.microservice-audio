import { ConditioningModel } from '../conditioning.model.js';
import ConditioningBit, {
  SomaticConditioningPayload,
  ConditionedSomaticResult,
} from '../fce/conditioning.bit.js';
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

export const initConditioning = (
  cpy: ConditioningModel,
  bal: ConditioningBit,
  ste: State,
): ConditioningModel => {
  cpy.profilesProcessed = 0;
  cpy.conditioningBits = {};
  if (bal.slv) bal.slv({ cndBit: { idx: 'init-conditioning', val: 1 } });
  return cpy;
};

export const updateConditioning = (
  cpy: ConditioningModel,
  bal: ConditioningBit,
  ste: State,
): ConditioningModel => {
  if (bal.idx) cpy.conditioningBits[bal.idx] = bal;
  if (bal.slv) bal.slv({ cndBit: bal });
  return cpy;
};

export const assertPhonationFeasibility = (
  dat: SomaticConditioningPayload,
): ConditionedSomaticResult => {
  const conditions = (dat.activeConditions || []).map((c) => c.toLowerCase());
  const bannedVerbs = (dat.bannedKineticVerbs || []).map((v) => v.toLowerCase());

  const hasMuteCondition =
    conditions.includes('mute') ||
    conditions.includes('cnd_vocal_cord_transected') ||
    conditions.includes('airway_blockage');

  const hasBannedSpeakVerb = bannedVerbs.includes('speak') || bannedVerbs.includes('vocalize');

  if (hasMuteCondition || hasBannedSpeakVerb) {
    const reason = hasMuteCondition
      ? `ACTIVE_CONDITION_MUTE: Character [${dat.characterId}] is physically incapable of vocalization.`
      : `BANNED_KINETIC_VERB: Character [${dat.characterId}] has 'speak' banned in physical kinetic mask.`;

    throw new Error(`VOCAL_DELIVERY_BREACH: ${reason}`);
  }

  const meters = {
    somaticFatigueBps: Math.max(0, Math.min(10000, dat.meters?.somaticFatigueBps ?? 0)),
    physicalPainBps: Math.max(0, Math.min(10000, dat.meters?.physicalPainBps ?? 0)),
    refusalStrainBps: Math.max(0, Math.min(10000, dat.meters?.refusalStrainBps ?? 0)),
    paranoiaPressureBps: Math.max(0, Math.min(10000, dat.meters?.paranoiaPressureBps ?? 0)),
  };

  return {
    status: 'VALID',
    characterId: dat.characterId,
    isPhonationFeasible: true,
    activeConditions: conditions,
    meters,
  };
};

export const validatePhonation = async (
  cpy: ConditioningModel,
  bal: ConditioningBit,
  ste: State,
): Promise<ConditioningModel> => {
  const dat = bal.dat;
  if (!dat?.characterId) {
    if (bal.slv) {
      bal.slv({
        cndBit: {
          idx: bal.idx,
          result: {
            status: 'BREACH',
            characterId: '',
            isPhonationFeasible: false,
            activeConditions: [],
            meters: { somaticFatigueBps: 0, physicalPainBps: 0, refusalStrainBps: 0, paranoiaPressureBps: 0 },
            error: 'MISSING_CHARACTER_ID',
          },
        },
      });
    }
    return cpy;
  }

  try {
    const result = assertPhonationFeasibility(dat);
    bal.result = result;
    await logConsole(`>> [OK] [SOMATIC] Phonation verified feasible for [${dat.characterId}]`);
  } catch (err: any) {
    const cleanErr = (err?.message || 'VOCAL_DELIVERY_BREACH').slice(0, 200);
    await logConsole(`:: [FAIL] [SOMATIC] ${cleanErr}`);
    bal.result = {
      status: 'BREACH',
      characterId: dat.characterId,
      isPhonationFeasible: false,
      activeConditions: dat.activeConditions || [],
      meters: { somaticFatigueBps: 0, physicalPainBps: 0, refusalStrainBps: 0, paranoiaPressureBps: 0 },
      error: cleanErr,
    };
  }

  cpy.profilesProcessed += 1;
  if (bal.slv) bal.slv({ cndBit: bal });
  return cpy;
};
