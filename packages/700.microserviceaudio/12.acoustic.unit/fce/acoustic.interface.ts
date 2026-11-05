import type AcousticBit from './acoustic.bit.js';

export default interface Acoustic {
  idx: string;
  modulationsResolved: number;
  acousticBits: Record<string, AcousticBit>;
}
