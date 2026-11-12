import fs from 'node:fs'
import path from 'node:path'
import { ModelModel } from '../model.model.js'
import type ModelBit from '../fce/model.bit.js'
import type {
    ModelResolutionPayload,
    LatentResolutionResult,
    MemoryBudgetReport,
    MmapArgsResult,
} from '../fce/model.bit.js'
import type {
    LatentTensorDescriptor,
    VocoderEngineType,
} from '../fce/model.interface.js'
import type State from '../../99.core/state.js'

const UPDATE_CONSOLE = '[Console action] Update Console'

const logConsole = async (
    ste: State | undefined,
    src: string,
): Promise<void> => {
    // Library-owned console actions must be hunted on the master LIBRARY bus;
    // package-bus hunts never settle (see day-002 003.phase-one V7).
    if (global.LIBRARY && typeof global.LIBRARY.hunt === 'function') {
        await global.LIBRARY.hunt(UPDATE_CONSOLE, { idx: 'cns00', src }).catch(
            () => {},
        )
        return
    }
    if (ste && typeof ste.hunt === 'function') {
        await ste.hunt(UPDATE_CONSOLE, { idx: 'cns00', src }).catch(() => {})
    }
}

/**
 * Asserts the current host process stays strictly within the 8.0 GB RAM boundary.
 */
export const assertHostMemoryBudget = (
    maxAllowedRamBytes: number = 8589934592,
): MemoryBudgetReport => {
    const mem = process.memoryUsage()
    const currentRssBytes = mem.rss
    const headroomBytes = maxAllowedRamBytes - currentRssBytes
    const passed = headroomBytes > 0

    return {
        status: passed ? 'PASSED' : 'FAILED',
        currentRssBytes,
        maxAllowedRamBytes,
        headroomBytes,
        error: passed
            ? undefined
            : `RAM_BUDGET_EXCEEDED: Process RSS [${currentRssBytes} bytes] breached 8.0 GB ceiling [${maxAllowedRamBytes} bytes].`,
    }
}

/**
 * Resolves the precomputed speaker embedding tensor path from upstream series-assets-audio.
 */
export const resolveLatentTensorPath = (
    seriesId: string,
    characterId: string,
    versionNumber: number = 1,
    customVaultRoot?: string,
): { exists: boolean; resolvedPath: string; fileSizeBytes: number } => {
    const candidateVaultRoots = [
        customVaultRoot,
        path.resolve(process.cwd(), '../series-assets-audio/voices', seriesId),
        path.resolve(
            process.cwd(),
            '../../series-assets-audio/voices',
            seriesId,
        ),
        path.resolve(
            process.cwd(),
            'node_modules/@camp_candor/series-assets-audio/voices',
            seriesId,
        ),
    ].filter(Boolean) as string[]

    const filename = `${characterId}_v${versionNumber}.pt`

    for (const root of candidateVaultRoots) {
        const candidatePath = path.resolve(root, 'embeddings', filename)
        if (fs.existsSync(candidatePath)) {
            const stats = fs.statSync(candidatePath)
            if (stats.size >= 1024) {
                return {
                    exists: true,
                    resolvedPath: candidatePath,
                    fileSizeBytes: stats.size,
                }
            }
        }
    }

    // Fallback predicted path for error logging
    const defaultTarget = path.resolve(
        candidateVaultRoots[0] ||
            path.resolve(
                process.cwd(),
                '../series-assets-audio/voices',
                seriesId,
            ),
        'embeddings',
        filename,
    )
    return { exists: false, resolvedPath: defaultTarget, fileSizeBytes: 0 }
}

/**
 * Generates the zero-VRAM memory-mapped CLI arguments and execution environment.
 */
export const buildMmapModelArgs = (
    engineId: VocoderEngineType,
    tensorPath: string,
    outputPath: string,
    text: string,
): MmapArgsResult => {
    const envOverrides: Record<string, string> = {
        CUDA_VISIBLE_DEVICES: '',
        OMP_NUM_THREADS: '4',
        MKL_NUM_THREADS: '4',
        TORCH_CPP_LOG_LEVEL: 'ERROR',
    }

    const cliArgs: string[] = [
        '--engine',
        engineId,
        '--mmap-latent',
        tensorPath,
        '--bypass-wav-resample',
        '--output',
        outputPath,
        '--text',
        text,
    ]

    return {
        engineId,
        cliArgs,
        envOverrides,
        resolvedTensorPath: tensorPath,
        isBypassingWavResample: true,
    }
}

export const initModel = (
    cpy: ModelModel,
    bal: ModelBit,
    _ste?: State,
): ModelModel => {
    cpy.loadedTensors = {}
    cpy.modelsLoadedCount = 0
    if (bal.slv) bal.slv({ mdlBit: { idx: 'init-model', val: 1 } })
    return cpy
}

export const updateModel = (
    cpy: ModelModel,
    bal: ModelBit,
    _ste?: State,
): ModelModel => {
    if (bal.idx) cpy.modelBits[bal.idx] = bal
    if (bal.slv) bal.slv({ mdlBit: bal })
    return cpy
}

export const auditMemoryBudget = async (
    cpy: ModelModel,
    bal: ModelBit,
    ste?: State,
): Promise<ModelModel> => {
    const report = assertHostMemoryBudget(cpy.maxAllowedRamBytes)
    bal.memoryReport = report

    const mbRss = (report.currentRssBytes / (1024 * 1024)).toFixed(1)
    const mbHeadroom = (report.headroomBytes / (1024 * 1024)).toFixed(1)

    await logConsole(
        ste,
        report.status === 'PASSED'
            ? `>> [RAM:OK] Host process RSS: ${mbRss} MB | Headroom: ${mbHeadroom} MB available.`
            : `:: [RAM:FAIL] ${report.error}`,
    )

    if (bal.slv) bal.slv({ mdlBit: bal })
    return cpy
}

export const resolveLatentTensor = async (
    cpy: ModelModel,
    bal: ModelBit,
    ste?: State,
): Promise<ModelModel> => {
    const payload: ModelResolutionPayload | undefined = bal.dat
    if (!payload || !payload.characterId || !payload.seriesId) {
        bal.result = {
            status: 'BREACH',
            characterId: payload?.characterId || 'unknown',
            versionNumber: payload?.versionNumber || 1,
            error: 'MISSING_MODEL_RESOLUTION_PAYLOAD',
        }
        if (bal.slv) bal.slv({ mdlBit: bal })
        return cpy
    }

    // 1. Audit memory headroom before tensor dereferencing
    const memReport = assertHostMemoryBudget(cpy.maxAllowedRamBytes)
    if (memReport.status !== 'PASSED') {
        bal.result = {
            status: 'RAM_OVERFLOW',
            characterId: payload.characterId,
            versionNumber: payload.versionNumber || 1,
            memoryReport: memReport,
            error: memReport.error,
        }
        await logConsole(
            ste,
            `:: [MODEL:FAIL] Memory gate tripped: ${memReport.error}`,
        )
        if (bal.slv) bal.slv({ mdlBit: bal })
        return cpy
    }

    // 2. Resolve .pt tensor file
    const version = payload.versionNumber || 1
    const tensorResolution = resolveLatentTensorPath(
        payload.seriesId,
        payload.characterId,
        version,
        payload.vaultRootPath,
    )

    if (!tensorResolution.exists) {
        bal.result = {
            status: 'MISSING_TENSOR',
            characterId: payload.characterId,
            versionNumber: version,
            error: `LATENT_TENSOR_NOT_FOUND_OR_CORRUPT: ${tensorResolution.resolvedPath}`,
        }
        await logConsole(
            ste,
            `:: [MODEL:WARN] Missing latent tensor: ${payload.characterId}_v${version}.pt. Resampling bypass disabled.`,
        )
        if (bal.slv) bal.slv({ mdlBit: bal })
        return cpy
    }

    const descriptor: LatentTensorDescriptor = {
        characterId: payload.characterId,
        versionNumber: version,
        absoluteTensorPath: tensorResolution.resolvedPath,
        fileSizeBytes: tensorResolution.fileSizeBytes,
        isMemoryMapped: true,
    }

    const engine = payload.engineOverride || cpy.activeEngine
    const mmapArgs = buildMmapModelArgs(
        engine,
        tensorResolution.resolvedPath,
        'scratch/audio/active_stem.wav',
        '',
    )

    cpy.loadedTensors[payload.characterId] = descriptor
    cpy.modelsLoadedCount += 1

    bal.result = {
        status: 'RESOLVED',
        characterId: payload.characterId,
        versionNumber: version,
        tensorDescriptor: descriptor,
        mmapArgs,
        memoryReport: memReport,
    }

    await logConsole(
        ste,
        `>> [MODEL:MMAP] Direct latent tensor mapped: ${tensorResolution.resolvedPath} (${(tensorResolution.fileSizeBytes / 1024).toFixed(1)} KB)`,
    )

    if (bal.slv) bal.slv({ mdlBit: bal })
    return cpy
}

export const configureMmapArgs = (
    cpy: ModelModel,
    bal: ModelBit,
    _ste?: State,
): ModelModel => {
    const engine = (bal.src as VocoderEngineType) || cpy.activeEngine
    const tensorPath = bal.dat?.vaultRootPath || 'scratch/embeddings/mock.pt'
    const args = buildMmapModelArgs(
        engine,
        tensorPath,
        'scratch/output.wav',
        '',
    )

    if (bal.slv) {
        bal.slv({
            mdlBit: {
                idx: bal.idx,
                val: 1,
                result: {
                    status: 'RESOLVED',
                    characterId: bal.dat?.characterId || 'mock',
                    versionNumber: 1,
                    mmapArgs: args,
                },
            },
        })
    }
    return cpy
}
