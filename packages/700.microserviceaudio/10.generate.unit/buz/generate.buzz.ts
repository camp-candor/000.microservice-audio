import { execFile } from 'node:child_process';
import path from 'node:path';
import { GenerateModel } from '../generate.model.js';
import GenerateBit, { GenerateConfig, GenerateResult } from '../fce/generate.bit.js';
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

export const initGenerate = (
  cpy: GenerateModel,
  bal: GenerateBit,
  ste: State,
): GenerateModel => {
  cpy.activeProcessCount = 0;
  cpy.generateBits = {};
  if (bal.slv) {
    bal.slv({ genBit: { idx: 'init-generate', val: 1 } });
  }
  return cpy;
};

export const updateGenerate = (
  cpy: GenerateModel,
  bal: GenerateBit,
  ste: State,
): GenerateModel => {
  if (bal.idx) {
    cpy.generateBits[bal.idx] = bal;
  }
  if (bal.slv) {
    bal.slv({ genBit: bal });
  }
  return cpy;
};

export const buildCliArgs = (cfg: GenerateConfig): string[] => {
  const args: string[] = [
    '--engine', cfg.engine,
    '--text', cfg.text,
    '--character', cfg.character,
    '--output', cfg.outputPath,
  ];

  if (cfg.emotion) {
    args.push('--emotion', cfg.emotion);
  }
  if (cfg.tonePacing !== undefined) {
    args.push('--pacing', cfg.tonePacing.toString());
  }

  // Engine adapters
  if (cfg.engine === 'styletts2' && cfg.styleVectorPath) {
    args.push('--style-vector', cfg.styleVectorPath);
  }
  if (cfg.engine === 'parler') {
    const descriptionPrompt = `Voice of ${cfg.character}. Emotion: ${cfg.emotion || 'neutral'}. High quality audio, dry room acoustics.`;
    args.push('--description-prompt', descriptionPrompt);
  }
  if (cfg.referenceWav) {
    args.push('--reference-wav', cfg.referenceWav);
  }

  // Somatic DSP argument serialization
  if (cfg.dspModifiers) {
    if (cfg.dspModifiers.basePitchShiftSemitones !== undefined) {
      args.push('--pitch-shift', cfg.dspModifiers.basePitchShiftSemitones.toString());
    }
    if (cfg.dspModifiers.formantWarpingFactor !== undefined) {
      args.push('--formant-warp', cfg.dspModifiers.formantWarpingFactor.toString());
    }
    if (cfg.dspModifiers.breathinessPauseMultiplier !== undefined) {
      args.push('--breathiness', cfg.dspModifiers.breathinessPauseMultiplier.toString());
    }
    if (cfg.dspModifiers.vocalFryDensity !== undefined) {
      args.push('--vocal-fry', cfg.dspModifiers.vocalFryDensity.toString());
    }
  }

  return args;
};

export const endGenerate = (
  cpy: GenerateModel,
  bal: GenerateBit,
  ste: State,
): GenerateModel => {
  cpy.activeProcessCount = Math.max(0, cpy.activeProcessCount - 1);
  if (bal.idx) {
    cpy.generateBits[bal.idx] = bal;
  }
  if (bal.slv) {
    bal.slv({ genBit: bal });
  }
  return cpy;
};

export const execGenerate = (
  cpy: GenerateModel,
  bal: GenerateBit,
  ste: State,
): GenerateModel => {
  const cfg = bal.dat;
  if (!cfg) {
    logConsole(':: [FAIL] Missing GenerateConfig payload in execGenerate');
    ste.dispatch({
      type: '[Generate action] End Generate',
      bale: {
        idx: bal.idx,
        result: {
          status: 'FAILED',
          outputPath: '',
          exitCode: 1,
          executionTimeMs: 0,
          stderr: 'MISSING_GENERATE_CONFIG',
        },
        slv: bal.slv
      } as GenerateBit
    });
    return cpy;
  }

  const pythonExecutable = cfg.pythonPath || process.env.PYTHON_BIN || 'python';
  const scriptPath = cfg.synthesizeScriptPath || path.resolve(process.cwd(), 'scripts/synthesize.py');
  const cliArgs = [scriptPath, ...buildCliArgs(cfg)];

  logConsole(`>> [SPAWN] Dispatching Python Subprocess for character [${cfg.character}]`);
  logConsole(`:: [ENGINE] Engine selected: ${cfg.engine}`);

  cpy.activeProcessCount += 1;
  const t0 = Date.now();

  // 0 MB VRAM Invariant: Restrict execution to CPU threads
  const spawnEnv = {
    ...process.env,
    CUDA_VISIBLE_DEVICES: '',
    OMP_NUM_THREADS: '4',
    MKL_NUM_THREADS: '4',
  };

  execFile(
    pythonExecutable,
    cliArgs,
    { env: spawnEnv, timeout: 30000 },
    async (error, stdout, stderr) => {
      const t1 = Date.now();
      const durationMs = t1 - t0;

      if (error) {
        const exitCode = typeof error.code === 'number' ? error.code : 1;
        const cleanErr = (stderr || error.message || 'UNKNOWN_ERROR').trim().slice(0, 300);
        await logConsole(`:: [FAIL] Subprocess crashed with code ${exitCode} after ${durationMs}ms`);
        await logConsole(`:: [STDERR] ${cleanErr}`);

        const result: GenerateResult = {
          status: 'FAILED',
          outputPath: cfg.outputPath,
          exitCode,
          executionTimeMs: durationMs,
          stderr: cleanErr,
        };

        ste.dispatch({
          type: '[Generate action] End Generate',
          bale: {
            ...bal,
            result
          }
        });
        return;
      }

      await logConsole(`>> [OK] Subprocess completed in ${durationMs}ms with Exit Code 0`);
      const result: GenerateResult = {
        status: 'SUCCESS',
        outputPath: cfg.outputPath,
        exitCode: 0,
        executionTimeMs: durationMs,
      };

      ste.dispatch({
        type: '[Generate action] End Generate',
        bale: {
          ...bal,
          result
        }
      });
    },
  );

  return cpy;
};
