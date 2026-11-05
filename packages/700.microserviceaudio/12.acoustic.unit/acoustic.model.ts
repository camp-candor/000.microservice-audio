import type Acoustic from './fce/acoustic.interface.js';
import type AcousticBit from './fce/acoustic.bit.js';

export class AcousticModel implements Acoustic {
  idx: string = '12.acoustic';
  modulationsResolved: number = 0;
  acousticBits: Record<string, AcousticBit> = {};
}
