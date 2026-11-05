/* eslint-disable */
import path from 'node:path'
import * as ActMnu from '../menu.action.js'
//import * as ActAgt from '../../00.agent.unit/agent.action.js';
import * as ActOlm from '../../00.microserviceaudio.unit/microserviceaudio.action.js'
import * as ActGen from '../../10.generate.unit/generate.action.js'

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
        ActOlm.LIST_MICROSERVICEAUDIO.split(']')[1],
        ActGen.EXEC_GENERATE.split(']')[1],
        FAIL_GENERATE_DEMO,
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
                    synthesizeScriptPath: demoScriptPath(
                        'missing-synthesize.py',
                    ),
                },
            })
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
