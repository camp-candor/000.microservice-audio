import type GenerateBit from './generate.bit.js';

export default interface Generate {
  idx: string;
  activeProcessCount: number;
  activePollingWatches: number;
  generateBits: Record<string, GenerateBit>;
}
