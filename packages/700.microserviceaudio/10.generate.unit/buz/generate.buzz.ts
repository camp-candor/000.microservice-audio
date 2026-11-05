import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { GenerateModel } from '../generate.model.js'
import GenerateBit, {
    GenerateConfig,
    GenerateResult,
    PollingConfig,
    PollingResult,
} from '../fce/generate.bit.js'
import State from '../../99.core/state.js'

const UPDATE_CONSOLE = '[Console action] Update Console'

const logConsole = async (src: string): Promise<void> => {
    if ((globalThis as any).LIBRARY?.hunt) {
        await (globalThis as any).LIBRARY.hunt(UPDATE_CONSOLE, {
            idx: 'cns00',
            src,
        })
    }
}

const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms))

export const initGenerate = (
    cpy: GenerateModel,
    bal: GenerateBit,
    ste: State,
): GenerateModel => {
    cpy.activeProcessCount = 0
    cpy.activePollingWatches = 0
    cpy.generateBits = {}
    if (bal.slv) {
        bal.slv({ genBit: { idx: 'init-generate', val: 1 } })
    }
    return cpy
}

export const updateGenerate = (
    cpy: GenerateModel,
    bal: GenerateBit,
    ste: State,
): GenerateModel => {
    if (bal.idx) {
        cpy.generateBits[bal.idx] = bal
    }
    if (bal.slv) {
        bal.slv({ genBit: bal })
    }
    return cpy
}

export const buildCliArgs = (cfg: GenerateConfig): string[] => {
    const args: string[] = [
        '--engine',
        cfg.engine,
        '--text',
        cfg.text,
        '--character',
        cfg.character,
        '--output',
        cfg.outputPath,
    ]

    if (cfg.emotion) args.push('--emotion', cfg.emotion)
    if (cfg.tonePacing !== undefined)
        args.push('--pacing', cfg.tonePacing.toString())

    if (cfg.engine === 'styletts2' && cfg.styleVectorPath) {
        args.push('--style-vector', cfg.styleVectorPath)
    }
    if (cfg.engine === 'parler') {
        const descriptionPrompt = `Voice of ${cfg.character}. Emotion: ${cfg.emotion || 'neutral'}. High quality audio, dry room acoustics.`
        args.push('--description-prompt', descriptionPrompt)
    }
    if (cfg.referenceWav) {
        args.push('--reference-wav', cfg.referenceWav)
    }

    if (cfg.dspModifiers) {
        if (cfg.dspModifiers.basePitchShiftSemitones !== undefined) {
            args.push(
                '--pitch-shift',
                cfg.dspModifiers.basePitchShiftSemitones.toString(),
            )
        }
        if (cfg.dspModifiers.formantWarpingFactor !== undefined) {
            args.push(
                '--formant-warp',
                cfg.dspModifiers.formantWarpingFactor.toString(),
            )
        }
        if (cfg.dspModifiers.breathinessPauseMultiplier !== undefined) {
            args.push(
                '--breathiness',
                cfg.dspModifiers.breathinessPauseMultiplier.toString(),
            )
        }
        if (cfg.dspModifiers.vocalFryDensity !== undefined) {
            args.push(
                '--vocal-fry',
                cfg.dspModifiers.vocalFryDensity.toString(),
            )
        }
    }

    return args
}

export const waitForBufferStabilization = async (
    cfg: PollingConfig,
): Promise<PollingResult> => {
    const interval = cfg.intervalMs ?? 200
    const timeout = cfg.timeoutMs ?? 30000
    const requiredStableCycles = cfg.stabilityChecksRequired ?? 2

    const t0 = Date.now()
    let attempts = 0
    let lastSize = -1
    let stableCount = 0

    // Same-Filesystem Inode Guard: Verify staging and target reside in the identical directory
    if (
        path.resolve(path.dirname(cfg.stagingPath)) !==
        path.resolve(path.dirname(cfg.targetPath))
    ) {
        const err =
            'CROSS_DIRECTORY_INODE_VIOLATION: Staging and target must reside in the same parent directory.'
        await logConsole(`:: [FAIL] ${err}`)
        return {
            status: 'INODE_ERROR',
            bytesConfirmed: 0,
            pollAttempts: 0,
            elapsedMs: 0,
            error: err,
        }
    }

    while (Date.now() - t0 < timeout) {
        attempts += 1
        await delay(interval)

        let stats: fs.Stats | null = null
        try {
            if (fs.existsSync(cfg.stagingPath)) {
                stats = fs.statSync(cfg.stagingPath)
            }
        } catch {
            // Inode locked or transiently unreadable
            stats = null
        }

        if (!stats) {
            stableCount = 0
            lastSize = -1
            continue
        }

        const currentSize = stats.size

        // Reject 0-byte poison buffers immediately during stabilization phase
        if (currentSize > 0 && currentSize === lastSize) {
            stableCount += 1
        } else {
            stableCount = 0
            lastSize = currentSize
        }

        if (stableCount >= requiredStableCycles) {
            const elapsed = Date.now() - t0
            await logConsole(
                `>> [POLL] Inode stabilized at ${currentSize} bytes (${attempts} attempts, ${elapsed}ms)`,
            )

            try {
                // Atomic POSIX pointer swap on the same filesystem
                fs.renameSync(cfg.stagingPath, cfg.targetPath)
                await logConsole(
                    `>> [RENAME] Promoted [${path.basename(cfg.stagingPath)}] -> [${path.basename(cfg.targetPath)}] [OK]`,
                )

                return {
                    status: 'STABILIZED',
                    bytesConfirmed: currentSize,
                    pollAttempts: attempts,
                    elapsedMs: elapsed,
                }
            } catch (renameErr: any) {
                const cleanErr = (renameErr?.message || 'RENAME_FAILED').slice(
                    0,
                    150,
                )
                await logConsole(`:: [FAIL] Atomic rename failed: ${cleanErr}`)
                return {
                    status: 'INODE_ERROR',
                    bytesConfirmed: currentSize,
                    pollAttempts: attempts,
                    elapsedMs: elapsed,
                    error: cleanErr,
                }
            }
        }
    }

    const totalElapsed = Date.now() - t0
    await logConsole(
        `:: [TIMEOUT] Polling exceeded timeout (${timeout}ms) for [${path.basename(cfg.stagingPath)}]`,
    )

    // Teardown: unlink dangling orphaned .tmp file on timeout
    try {
        if (fs.existsSync(cfg.stagingPath)) {
            fs.unlinkSync(cfg.stagingPath)
            await logConsole(
                `:: [PURGE] Unlinked orphaned staging buffer: ${cfg.stagingPath}`,
            )
        }
    } catch {}

    return {
        status: 'TIMEOUT',
        bytesConfirmed: Math.max(0, lastSize),
        pollAttempts: attempts,
        elapsedMs: totalElapsed,
        error: `TIMEOUT_EXCEEDED_${timeout}MS`,
    }
}

export const pollFileStabilization = async (
    cpy: GenerateModel,
    bal: GenerateBit,
    ste: State,
): Promise<GenerateModel> => {
    const pollCfg = bal.pollDat
    if (!pollCfg) {
        if (bal.slv) {
            bal.slv({
                genBit: {
                    idx: bal.idx,
                    pollResult: {
                        status: 'INODE_ERROR',
                        bytesConfirmed: 0,
                        pollAttempts: 0,
                        elapsedMs: 0,
                        error: 'MISSING_POLL_CONFIG',
                    },
                },
            })
        }
        return cpy
    }

    cpy.activePollingWatches += 1
    const result = await waitForBufferStabilization(pollCfg)
    cpy.activePollingWatches = Math.max(0, cpy.activePollingWatches - 1)

    bal.pollResult = result
    if (bal.slv) {
        bal.slv({ genBit: bal })
    }
    return cpy
}

export const execGenerate = async (
    cpy: GenerateModel,
    bal: GenerateBit,
    ste: State,
): Promise<GenerateModel> => {
    const cfg = bal.dat
    if (!cfg) {
        await logConsole(
            ':: [FAIL] Missing GenerateConfig payload in execGenerate',
        )
        if (bal.slv) {
            bal.slv({
                genBit: {
                    idx: bal.idx,
                    result: {
                        status: 'FAILED',
                        outputPath: '',
                        exitCode: 1,
                        executionTimeMs: 0,
                        stderr: 'MISSING_GENERATE_CONFIG',
                    },
                },
            })
        }
        return cpy
    }

    // Derive staging path (.tmp) and canonical final target path
    const targetPath = cfg.outputPath.endsWith('.tmp')
        ? cfg.outputPath.slice(0, -4)
        : cfg.outputPath
    const stagingPath = cfg.outputPath.endsWith('.tmp')
        ? cfg.outputPath
        : `${cfg.outputPath}.tmp`

    // Inject computed staging output into Python invocation
    const adjustedCfg: GenerateConfig = {
        ...cfg,
        outputPath: stagingPath,
    }

    const pythonExecutable =
        adjustedCfg.pythonPath || process.env.PYTHON_BIN || 'python'
    const scriptPath =
        adjustedCfg.synthesizeScriptPath ||
        path.resolve(process.cwd(), 'scripts/synthesize.py')
    const cliArgs = [scriptPath, ...buildCliArgs(adjustedCfg)]

    await logConsole(
        `>> [SPAWN] Dispatching Python Subprocess for character [${adjustedCfg.character}]`,
    )

    cpy.activeProcessCount += 1
    const t0 = Date.now()

    return new Promise<GenerateModel>((resolve) => {
        const spawnEnv = {
            ...process.env,
            CUDA_VISIBLE_DEVICES: '',
            OMP_NUM_THREADS: '4',
            MKL_NUM_THREADS: '4',
        }

        execFile(
            pythonExecutable,
            cliArgs,
            { env: spawnEnv, timeout: 30000 },
            async (error, stdout, stderr) => {
                cpy.activeProcessCount = Math.max(0, cpy.activeProcessCount - 1)
                const t1 = Date.now()
                const durationMs = t1 - t0

                if (error) {
                    const exitCode =
                        typeof error.code === 'number' ? error.code : 1
                    const cleanErr = (
                        stderr ||
                        error.message ||
                        'UNKNOWN_ERROR'
                    )
                        .trim()
                        .slice(0, 300)
                    await logConsole(
                        `:: [FAIL] Subprocess crashed with code ${exitCode} after ${durationMs}ms`,
                    )
                    await logConsole(`:: [STDERR] ${cleanErr}`)

                    // Clean up dangling .tmp file if crashed mid-write
                    try {
                        if (fs.existsSync(stagingPath))
                            fs.unlinkSync(stagingPath)
                    } catch {}

                    const result: GenerateResult = {
                        status: 'FAILED',
                        outputPath: targetPath,
                        exitCode,
                        executionTimeMs: durationMs,
                        stderr: cleanErr,
                    }

                    bal.result = result
                    if (bal.slv) bal.slv({ genBit: bal })
                    resolve(cpy)
                    return
                }

                await logConsole(
                    `>> [SUBPROCESS:OK] Child process finished in ${durationMs}ms. Initiating buffer stabilization check...`,
                )

                // Phase 2: Inode Polling & Quiescence Verification Loop
                cpy.activePollingWatches += 1
                const pollResult = await waitForBufferStabilization({
                    stagingPath,
                    targetPath,
                    intervalMs: cfg.polling?.intervalMs ?? 200,
                    timeoutMs: cfg.polling?.timeoutMs ?? 30000,
                    stabilityChecksRequired:
                        cfg.polling?.stabilityChecksRequired ?? 2,
                })
                cpy.activePollingWatches = Math.max(
                    0,
                    cpy.activePollingWatches - 1,
                )

                if (pollResult.status !== 'STABILIZED') {
                    await logConsole(
                        `:: [FAIL] Buffer failed to stabilize: ${pollResult.error || pollResult.status}`,
                    )
                    const result: GenerateResult = {
                        status: 'FAILED',
                        outputPath: targetPath,
                        exitCode: 1,
                        executionTimeMs: durationMs + pollResult.elapsedMs,
                        stderr: pollResult.error || 'STABILIZATION_FAILED',
                    }
                    bal.result = result
                    if (bal.slv) bal.slv({ genBit: bal })
                    resolve(cpy)
                    return
                }

                const result: GenerateResult = {
                    status: 'SUCCESS',
                    outputPath: targetPath,
                    exitCode: 0,
                    executionTimeMs: durationMs + pollResult.elapsedMs,
                    bytesConfirmed: pollResult.bytesConfirmed,
                }

                bal.result = result
                if (bal.slv) bal.slv({ genBit: bal })
                resolve(cpy)
            },
        )
    })
}
