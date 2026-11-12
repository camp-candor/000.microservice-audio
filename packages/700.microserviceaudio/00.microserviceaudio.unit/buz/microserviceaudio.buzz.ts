import { MicroserviceaudioModel } from '../microserviceaudio.model.js'
import type MicroserviceaudioBit from '../fce/microserviceaudio.bit.js'
import { executeSynthesisPipeline } from '../../03.pipeline.unit/buz/pipeline.buzz.js'
import { PipelineModel } from '../../03.pipeline.unit/pipeline.model.js'
import type { SynthesisPipelinePayload } from '../../03.pipeline.unit/fce/pipeline.bit.js'
import type State from '../../99.core/state.js'

const UPDATE_CONSOLE = '[Console action] Update Console'

const logConsole = async (
    ste: State | undefined,
    src: string,
): Promise<void> => {
    // Library-owned console actions must be hunted on the master LIBRARY bus;
    // hunting them on the package bus never settles (no library slv attached).
    if ((globalThis as any).LIBRARY?.hunt) {
        await (globalThis as any).LIBRARY.hunt(UPDATE_CONSOLE, {
            idx: 'cns00',
            src,
        }).catch(() => {})
        return
    }
    if (ste && typeof ste.hunt === 'function') {
        await ste.hunt(UPDATE_CONSOLE, { idx: 'cns00', src }).catch(() => {})
    }
}

export const initMicroserviceaudio = (
    cpy: MicroserviceaudioModel,
    bal: MicroserviceaudioBit,
    _ste?: State,
): MicroserviceaudioModel => {
    if (bal.slv) bal.slv({ msaBit: { idx: 'init-microserviceaudio', val: 1 } })
    return cpy
}

export const updateMicroserviceaudio = (
    cpy: MicroserviceaudioModel,
    bal: MicroserviceaudioBit,
    _ste?: State,
): MicroserviceaudioModel => {
    if (!cpy.microserviceaudioBits) cpy.microserviceaudioBits = {}
    if (bal.idx) cpy.microserviceaudioBits[bal.idx] = bal
    if (bal.slv) bal.slv({ msaBit: bal })
    return cpy
}

export const testMicroserviceaudio = (
    cpy: MicroserviceaudioModel,
    bal: MicroserviceaudioBit,
    _ste?: State,
): MicroserviceaudioModel => {
    if (bal.slv) bal.slv({ mytBit: { idx: 'test-microserviceaudio', val: 1 } })
    return cpy
}

export const listMicroserviceaudio = async (
    cpy: MicroserviceaudioModel,
    bal: MicroserviceaudioBit,
    _ste?: State,
): Promise<MicroserviceaudioModel> => {
    if (bal.slv)
        bal.slv({
            olmBit: {
                idx: 'list-microserviceaudio',
                lst: [],
            },
        })
    return cpy
}

/**
 * Delegates line or scene batch synthesis runs directly to 03.pipeline.unit.
 */
export const synthesizeMicroserviceaudio = async (
    cpy: MicroserviceaudioModel,
    bal: MicroserviceaudioBit,
    ste?: State,
): Promise<MicroserviceaudioModel> => {
    const rawDat = bal.dat as
        | SynthesisPipelinePayload
        | { lines: SynthesisPipelinePayload[] }
        | undefined
    if (!rawDat) {
        bal.val = 0
        bal.src = 'MISSING_SYNTHESIS_DELEGATION_PAYLOAD'
        await logConsole(
            ste,
            ':: [FAIL] [MSA] Missing delegation payload in synthesizeMicroserviceaudio.',
        )
        if (bal.slv) bal.slv({ msaBit: bal })
        return cpy
    }

    const lines: SynthesisPipelinePayload[] = Array.isArray(
        (rawDat as any).lines,
    )
        ? (rawDat as { lines: SynthesisPipelinePayload[] }).lines
        : [rawDat as SynthesisPipelinePayload]

    const pipelineModel = new PipelineModel()
    let allPassed = true

    for (const linePayload of lines) {
        const pplBit: any = {
            idx: `msa-delegate-${linePayload.lineId}`,
            dat: linePayload,
        }
        await executeSynthesisPipeline(pipelineModel, pplBit, ste)
        if (pplBit.val !== 1) {
            allPassed = false
            bal.src = pplBit.error || 'PIPELINE_DELEGATION_FAILED'
            break
        }
    }

    bal.val = allPassed ? 1 : 0
    if (allPassed) {
        await logConsole(
            ste,
            `>> [OK] [MSA] Delegated ${lines.length} line(s) cleanly through 03.pipeline.unit.`,
        )
    }

    if (bal.slv) bal.slv({ msaBit: bal })
    return cpy
}
