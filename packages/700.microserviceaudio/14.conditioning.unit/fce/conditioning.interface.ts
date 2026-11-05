import type ConditioningBit from './conditioning.bit.js';

export default interface Conditioning {
  idx: string;
  profilesProcessed: number;
  conditioningBits: Record<string, ConditioningBit>;
}
