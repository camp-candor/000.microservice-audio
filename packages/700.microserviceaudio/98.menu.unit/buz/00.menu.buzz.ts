/* eslint-disable */
import path from 'node:path'
import * as ActMnu from '../menu.action.js'
//import * as ActAgt from '../../00.agent.unit/agent.action.js';
import * as ActOlm from '../../00.microserviceaudio.unit/microserviceaudio.action.js'
import * as ActGen from '../../10.generate.unit/generate.action.js'
import * as ActLdn from '../../01.loudness.unit/loudness.action.js'
import * as ActPek from '../../02.peaks.unit/peaks.action.js'
import * as ActTrn from '../../06.transcription.unit/transcription.action.js'
import * as ActSch from '../../08.schemas.unit/schemas.action.js'

import type { MenuModel } from '../menu.model.js'
import type MenuBit from '../fce/menu.bit.js'
import type State from '../../99.core/state.js'

import * as Grid from '../../val/grid.js'
import * as Align from '../../val/align.js'
import * as Color from '../../val/console-color.js'

import * as SHAPE from '../../val/shape.js'
import * as FOCUS from '../../val/focus.js'

let bit, lst, dex, idx, dat, src, val
let rootSlv

let SOWER, AGENT, CLICKUP, MICROSERVICEAUDIO

const UPDATE_GRID = '[Grid action] Update Grid'
const WRITE_CONSOLE = '[Write action] Write Console'
const UPDATE_CONSOLE = '[Console action] Update Console'
const OPEN_CHOICE = '[Open action] Open Choice'
const CLOSE_TERMINAL = '[Close action] Close Terminal'
const PRINT_MENU = '[Render action] Print Menu'

const FAIL_GENERATE_DEMO = ' Fail Generate Demo'

const demoScriptPath = (file: string): string => {
    const root = process.env.INIT_CWD || process.cwd()
    return path.resolve(
        root,
        'packages/700.microserviceaudio/10.generate.unit/fixture',
        file,
    )
}

const auditStem = async (
    ste: State,
    stemPath: string,
    expectedText: string,
): Promise<void> => {
    await ste.hunt(ActTrn.VERIFY_TRANSCRIPTION_PARITY, {
        idx: 'demo-parity',
        dat: { filePath: stemPath, expectedText },
    })
    await ste.hunt(ActLdn.AUDIT_LOUDNESS, {
        idx: 'demo-loudness',
        dat: {
            filePath: stemPath,
            profile: { targetLufs: -16.0, toleranceLufs: 1.0 },
        },
    })
    await ste.hunt(ActPek.AUDIT_PEAKS, {
        idx: 'demo-peaks',
        dat: { filePath: stemPath, maxTruePeakDbTp: -1.0 },
    })
}

export const initMenu = async (cpy: MenuModel, bal: MenuBit, ste: State) => {
    if (bal.slv != null) rootSlv = bal.slv

    bit = await global.LIBRARY.hunt(UPDATE_GRID, {
        x: 4,
        y: 0,
        xSpan: 8,
        ySpan: 12,
    })
    bit = await global.LIBRARY.hunt(WRITE_CONSOLE, {
        idx: 'cns00',
        src: '',
        dat: { net: bit.grdBit.dat, src: 'alligaor0' },
    })

    bit = await global.LIBRARY.hunt(UPDATE_CONSOLE, {
        idx: 'cns00',
        src: '-----------',
    })
    bit = await global.LIBRARY.hunt(UPDATE_CONSOLE, {
        idx: 'cns00',
        src: 'MICROSERVICEAUDIO MENU',
    })

    bit = await global.LIBRARY.hunt(UPDATE_CONSOLE, {
        idx: 'cns00',
        src: '-----------',
    })

    await updateMenu(cpy, bal, ste)

    return cpy
}

export const updateMenu = async (cpy: MenuModel, bal: MenuBit, ste: State) => {
    lst = [
        ActOlm.UPDATE_MICROSERVICEAUDIO.split(']')[1],
        ActOlm.TEST_MICROSERVICEAUDIO.split(']')[1],
        ActGen.EXEC_GENERATE.split(']')[1],
        FAIL_GENERATE_DEMO,
        '[SCHEMA: AUDIT INGRESS CONTRACT]',
        'ROOT MENU',
    ]

    bit = await global.LIBRARY.hunt(UPDATE_GRID, {
        x: 0,
        y: 4,
        xSpan: 4,
        ySpan: 8,
    })
    bit = await global.LIBRARY.hunt(OPEN_CHOICE, {
        dat: { clr0: Color.BLACK, clr1: Color.YELLOW },
        src: Align.VERTICAL,
        lst,
        net: bit.grdBit.dat,
    })

    src = bit.chcBit.src

    switch (src) {
        case '[SCHEMA: AUDIT INGRESS CONTRACT]':
        case ' [SCHEMA: AUDIT INGRESS CONTRACT]':
        case 'SCHEMA: AUDIT INGRESS CONTRACT':
        case ' SCHEMA: AUDIT INGRESS CONTRACT':
        case 'AUDIT INGRESS CONTRACT':
        case ' AUDIT INGRESS CONTRACT':
            // 1. Valid contract audit
            await ste.hunt(ActSch.VALIDATE_INGRESS_CONTRACT, {
                idx: 'demo-schema-valid',
                dat: {
                    sceneAst: {
                        sceneId: 'sc_14',
                        seriesId: 'series_candor_01',
                        state_snapshot_hash:
                            'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
                        dialogueLines: [
                            {
                                lineId: 'line_01',
                                shotIndex: 0,
                                character: 'char_wart',
                                text: 'Hold the gates.',
                                emotion: 'tense',
                                tonePacing: 1.0,
                            },
                        ],
                    },
                },
            })

            // 2. Parity audit
            await ste.hunt(ActSch.VALIDATE_SCRIPT_PARITY, {
                idx: 'demo-parity-valid',
                dat: {
                    dialogueLine: {
                        lineId: 'line_01',
                        character: 'char_wart',
                        text: 'Hold the gates.',
                    },
                    expectedScriptText: 'Hold the gates.',
                },
            })

            // 3. Negative control display
            await ste.hunt(ActSch.VALIDATE_INGRESS_CONTRACT, {
                idx: 'demo-schema-invalid',
                dat: {
                    sceneAst: {
                        sceneId: 'sc_err',
                        seriesId: 'series_candor_01',
                        state_snapshot_hash: 'bad_snapshot_hash',
                        dialogueLines: [
                            {
                                lineId: 'line_err',
                                shotIndex: 0,
                                character: 'char_wart',
                                text: 'Hold the gates.',
                            },
                        ],
                    },
                },
            })

            await new Promise((resolve) => setTimeout(resolve, 3000))
            break

        case ActOlm.UPDATE_MICROSERVICEAUDIO.split(']')[1]:
            bit = await ste.hunt(ActOlm.UPDATE_MICROSERVICEAUDIO, {
                content: 'Microserviceaudio Menu Selected',
            })
            bit = await global.LIBRARY.hunt(PRINT_MENU, bit)
            break

        case ActOlm.TEST_MICROSERVICEAUDIO.split(']')[1]:
            bit = await ste.hunt(ActOlm.TEST_MICROSERVICEAUDIO, {
                content: 'Microserviceaudio Menu Selected',
            })
            bit = await global.LIBRARY.hunt(PRINT_MENU, bit)
            break

        case ActOlm.LIST_MICROSERVICEAUDIO.split(']')[1]:
            bit = await ste.hunt(ActOlm.LIST_MICROSERVICEAUDIO, {})
            lst = bit.olmBit.lst

            if (lst.length === 0) {
                bit = await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                    idx: 'cns00',
                    src: 'No Microserviceaudio Models Found',
                })
            } else {
                bit = await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                    idx: 'cns00',
                    src: 'Listing Microserviceaudio Models...',
                })
                lst.forEach((a: string) =>
                    global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: a,
                    }),
                )
            }

            await new Promise((resolve) => setTimeout(resolve, 3000))
            break

        case ActGen.EXEC_GENERATE.split(']')[1]:
            bit = await ste.hunt(ActGen.EXEC_GENERATE, {
                idx: 'demo-line',
                dat: {
                    engine: 'styletts2',
                    character: 'char_demo',
                    text: 'Demo line for cockpit synthesis.',
                    emotion: 'neutral',
                    outputPath: 'scratch/audio/demo_line.wav.tmp',
                    styleVectorPath: 'assets/voices/demo_style.pt',
                    synthesizeScriptPath: demoScriptPath('synthesize.py'),
                },
            })
            if (
                bit?.genBit?.result?.status === 'SUCCESS' &&
                bit.genBit.result.outputPath
            ) {
                await auditStem(
                    ste,
                    bit.genBit.result.outputPath,
                    'Demo line for cockpit synthesis.',
                )
            }
            await new Promise((resolve) => setTimeout(resolve, 3000))
            break

        case FAIL_GENERATE_DEMO:
            bit = await ste.hunt(ActGen.EXEC_GENERATE, {
                idx: 'demo-fail',
                dat: {
                    engine: 'piper',
                    character: 'char_demo',
                    text: 'Demo line for failure telemetry.',
                    outputPath: 'scratch/audio/demo_fail.wav.tmp',
                    synthesizeScriptPath: demoScriptPath('synthesize_empty.py'),
                    polling: {
                        stagingPath: 'scratch/audio/demo_fail.wav.tmp',
                        targetPath: 'scratch/audio/demo_fail.wav',
                        intervalMs: 100,
                        timeoutMs: 2000,
                        stabilityChecksRequired: 2,
                    },
                },
            })
            bit = await ste.hunt(ActGen.EXEC_GENERATE, {
                idx: 'demo-hot',
                dat: {
                    engine: 'piper',
                    character: 'char_demo',
                    text: 'Demo line for breach telemetry.',
                    outputPath: 'scratch/audio/demo_hot.wav.tmp',
                    synthesizeScriptPath: demoScriptPath('synthesize_loud.py'),
                },
            })
            if (
                bit?.genBit?.result?.status === 'SUCCESS' &&
                bit.genBit.result.outputPath
            ) {
                await auditStem(
                    ste,
                    bit.genBit.result.outputPath,
                    'Demo line for breach telemetry.',
                )
            }
            await new Promise((resolve) => setTimeout(resolve, 3000))
            break

        case 'ROOT MENU':
            if (rootSlv != null) rootSlv({ mnuBit: { idx: 'root-menu' } })
            return cpy

        default:
            bit = await ste.hunt(CLOSE_TERMINAL, {})
            break
    }

    setTimeout(async () => {
        bit = await ste.hunt(ActMnu.UPDATE_MENU, {})
    }, 333)

    return cpy
}

const patch = (ste, type, bale) => ste.dispatch({ type, bale })
