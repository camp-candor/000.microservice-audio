export interface SomaticDspModifiers {
  basePitchShiftSemitones?: number;
  formantWarpingFactor?: number;
  breathinessPauseMultiplier?: number;
  vocalFryDensity?: number;
}

export interface GenerateConfig {
  engine: 'styletts2' | 'parler' | 'piper';
  character: string;
  text: string;
  emotion?: string;
  tonePacing?: number;
  outputPath: string;
  referenceWav?: string;
  styleVectorPath?: string;
  dspModifiers?: SomaticDspModifiers;
  pythonPath?: string;
  synthesizeScriptPath?: string;
}

export interface GenerateResult {
  status: 'SUCCESS' | 'FAILED';
  outputPath: string;
  exitCode: number;
  executionTimeMs: number;
  stderr?: string;
}

export default interface GenerateBit {
  idx: string;
  src?: string;
  val?: number;
  dat?: GenerateConfig;
  result?: GenerateResult;
  slv?: (result: { genBit: GenerateBit }) => void;
}
