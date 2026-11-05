import { describe, it, expect, vi } from 'vitest';
import { buildCliArgs } from '../10.generate.unit/buz/generate.buzz.js';
import { GenerateConfig } from '../10.generate.unit/fce/generate.bit.js';

describe('10.generate.unit: CLI Argument Serializer', () => {
  it('serializes StyleTTS-2 configuration with somatic DSP parameters', () => {
    const config: GenerateConfig = {
      engine: 'styletts2',
      character: 'char_wart',
      text: 'Stand your ground.',
      emotion: 'tense',
      tonePacing: 1.2,
      outputPath: 'scratch/audio/ep01_sh01.wav.tmp',
      styleVectorPath: 'assets/voices/wart_style.pt',
      dspModifiers: {
        basePitchShiftSemitones: -2.5,
        formantWarpingFactor: 1.15,
        breathinessPauseMultiplier: 2.0,
        vocalFryDensity: 0.8,
      },
    };

    const args = buildCliArgs(config);

    expect(args).toContain('--engine');
    expect(args).toContain('styletts2');
    expect(args).toContain('--character');
    expect(args).toContain('char_wart');
    expect(args).toContain('--style-vector');
    expect(args).toContain('assets/voices/wart_style.pt');
    expect(args).toContain('--pitch-shift');
    expect(args).toContain('-2.5');
    expect(args).toContain('--formant-warp');
    expect(args).toContain('1.15');
    expect(args).toContain('--breathiness');
    expect(args).toContain('2');
    expect(args).toContain('--vocal-fry');
    expect(args).toContain('0.8');
  });

  it('compiles Parler natural language description prompt on demand', () => {
    const config: GenerateConfig = {
      engine: 'parler',
      character: 'char_octavius',
      text: 'Lower the portcullis now!',
      emotion: 'enraged',
      outputPath: 'scratch/audio/ep01_sh02.wav.tmp',
    };

    const args = buildCliArgs(config);

    expect(args).toContain('--engine');
    expect(args).toContain('parler');
    expect(args).toContain('--description-prompt');
    const descIdx = args.indexOf('--description-prompt');
    expect(args[descIdx + 1]).toContain('Voice of char_octavius');
    expect(args[descIdx + 1]).toContain('Emotion: enraged');
  });
});
