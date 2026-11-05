/* eslint-disable */
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import * as ActMnu from '../menu.action.js'
//import * as ActAgt from '../../00.agent.unit/agent.action.js';
import * as ActOlm from '../../00.microserviceaudio.unit/microserviceaudio.action.js'
import * as ActGen from '../../10.generate.unit/generate.action.js'
import * as ActLdn from '../../01.loudness.unit/loudness.action.js'
import * as ActPek from '../../02.peaks.unit/peaks.action.js'
import * as ActTrn from '../../06.transcription.unit/transcription.action.js'
import * as ActSch from '../../08.schemas.unit/schemas.action.js'
import * as ActFlt from '../../11.filter.unit/filter.action.js'
import * as ActDsr from '../../16.deesser.unit/deesser.action.js'

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

const edgeRoot = (): string => {
    let dir = __dirname
    for (let i = 0; i < 8; i++) {
        try {
            const pkg = JSON.parse(
                fs.readFileSync(path.join(dir, 'package.json'), 'utf8'),
            )
            if (pkg?.workspaces) return dir
        } catch {}
        const parent = path.dirname(dir)
        if (parent === dir) break
        dir = parent
    }
    return process.env.INIT_CWD || process.cwd()
}

const readWranglerConfig = (): any => {
    const raw = fs.readFileSync(
        path.resolve(edgeRoot(), 'apps/worker/wrangler.jsonc'),
        'utf8',
    )
    // Minimal JSONC tolerance: line comments + trailing commas
    const stripped = raw
        .split('\n')
        .map((line) => line.replace(/\/\/.*$/, ''))
        .join('\n')
        .replace(/,(\s*[}\]])/g, '$1')
    return JSON.parse(stripped)
}

const assertEdgeBindings = (cfg: any): string | null => {
    if (cfg?.name !== 'microservice-audio-worker')
        return 'unexpected worker name'
    if (cfg?.main !== 'src/index.ts') return 'unexpected main entrypoint'
    if (cfg?.compatibility_date !== '2026-01-07')
        return 'unexpected compatibility_date'
    if (!cfg?.compatibility_flags?.includes('nodejs_compat'))
        return 'missing nodejs_compat flag'
    const dob = cfg?.durable_objects?.bindings?.find(
        (b: any) => b?.name === 'AUDIO_LEASE_DO',
    )
    if (!dob || dob.class_name !== 'AudioLeaseDO')
        return 'missing durable_objects binding AUDIO_LEASE_DO'
    const mig = cfg?.migrations?.find((m: any) => m?.tag === 'v1')
    if (!mig?.new_sqlite_classes?.includes('AudioLeaseDO'))
        return 'missing v1 sqlite migration for AudioLeaseDO'
    if (!cfg?.d1_databases?.some((d: any) => d?.binding === 'CANON_DB'))
        return 'missing d1 binding CANON_DB'
    if (!cfg?.r2_buckets?.some((b: any) => b?.binding === 'AUDIO_STEMS_BUCKET'))
        return 'missing r2 binding AUDIO_STEMS_BUCKET'
    const stg = cfg?.env?.staging
    if (
        !stg?.durable_objects?.bindings?.some(
            (b: any) => b?.name === 'AUDIO_LEASE_DO',
        )
    )
        return 'staging missing AUDIO_LEASE_DO'
    if (!stg?.d1_databases?.some((d: any) => d?.binding === 'CANON_DB'))
        return 'staging missing CANON_DB'
    if (!stg?.r2_buckets?.some((b: any) => b?.binding === 'AUDIO_STEMS_BUCKET'))
        return 'staging missing AUDIO_STEMS_BUCKET'
    return null
}

const demoSpectralStem = (): Buffer => {
    const sampleRate = 48000
    const count = 4800
    const buf = Buffer.alloc(44 + count * 2, 0)
    buf.write('RIFF', 0, 'ascii')
    buf.write('WAVE', 8, 'ascii')
    buf.write('fmt ', 12, 'ascii')
    buf.write('data', 36, 'ascii')
    buf.writeUInt32LE(count * 2, 40)
    for (let i = 0; i < count; i++) {
        const rumble = Math.sin((2 * Math.PI * 30 * i) / sampleRate) * 0.05
        const spike = i === 100 ? 0.95 : 0
        const v = Math.max(-1.0, Math.min(1.0, 0.15 + rumble + spike))
        buf.writeInt16LE(Math.floor(v * 32767), 44 + i * 2)
    }
    return buf
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
        '[EDGE: VERIFY WORKER SCAFFOLD]',
        '[FILTER: RUN SPECTRAL HYGIENE GAUNTLET]',
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
        case '[EDGE: VERIFY WORKER SCAFFOLD]':
        case ' [EDGE: VERIFY WORKER SCAFFOLD]':
        case 'EDGE: VERIFY WORKER SCAFFOLD':
        case 'VERIFY WORKER SCAFFOLD':
            // 0. Cloudflare runtime shim (TUI runs outside the isolate)
            try {
                require('tsx/cjs')
                const Module = require('node:module')
                const shimPath = path.join(
                    edgeRoot(),
                    'node_modules',
                    '__cf_workers_shim__.js',
                )
                if (!require.cache[shimPath]) {
                    const shim = new Module(shimPath, null)
                    shim._compile(
                        'exports.DurableObject = class DurableObject {}',
                        shimPath,
                    )
                    require.cache[shimPath] = shim
                }
                const moduleAny: any = Module
                if (!moduleAny.__cfShimInstalled) {
                    const origResolve = Module._resolveFilename
                    Module._resolveFilename = function (
                        request: string,
                        ...rest: any[]
                    ) {
                        if (request === 'cloudflare:workers') return shimPath
                        return origResolve.call(this, request, ...rest)
                    }
                    moduleAny.__cfShimInstalled = true
                }
            } catch {}

            // 1. Scaffolding + binding verification
            try {
                const fault = assertEdgeBindings(readWranglerConfig())
                if (fault) {
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: `:: [FAIL] [EDGE:BINDING] Broken binding detected: ${fault}`,
                    })
                } else {
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: '>> [OK] [EDGE:WORKER] Cloudflare Worker Edge Gateway scaffolding verified',
                    })
                }
            } catch (err: any) {
                const detail = (err?.message || 'wrangler parse error').slice(
                    0,
                    120,
                )
                await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                    idx: 'cns00',
                    src: `:: [FAIL] [EDGE:BINDING] Broken binding detected: ${detail}`,
                })
            }

            // 2. Live isolate /health dispatch
            try {
                require('tsx/cjs')
                const workerPath = path.resolve(
                    edgeRoot(),
                    'apps/worker/src/index.ts',
                )
                const worker = require(workerPath)
                const app = worker.default || worker
                const res = await app.fetch(
                    new Request('http://localhost/health'),
                    {},
                )
                const body: any = await res.json()
                if (res.status === 200 && body?.status === 'HEALTHY') {
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: '>> [OK] [EDGE:ISOLATE] Route /health responded 200 OK (HEALTHY)',
                    })
                } else {
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: `:: [FAIL] [EDGE:BINDING] Broken binding detected: /health responded ${res.status}`,
                    })
                }
            } catch (err: any) {
                const detail = (
                    err?.message || 'isolate dispatch failed'
                ).slice(0, 120)
                await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                    idx: 'cns00',
                    src: `:: [FAIL] [EDGE:BINDING] Broken binding detected: ${detail}`,
                })
            }

            // 3. Negative control: corrupted config must fail closed
            try {
                const corrupted = readWranglerConfig()
                corrupted.durable_objects.bindings = []
                const fault = assertEdgeBindings(corrupted)
                if (fault) {
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: `:: [FAIL] [EDGE:BINDING] Broken binding detected: ${fault}`,
                    })
                }
            } catch {}

            // 4. Live HMAC auth probe (valid signature)
            try {
                require('tsx/cjs')
                const workerPath = path.resolve(
                    edgeRoot(),
                    'apps/worker/src/index.ts',
                )
                const worker = require(workerPath)
                const app = worker.default || worker
                const demoSecret = 'cockpit_demo_hmac_secret_2026'
                const demoEnv: any = { AUDIO_GATEWAY_SECRET: demoSecret }
                const payload = JSON.stringify({ sceneId: 'demo_sc01' })
                const signature = crypto
                    .createHmac('sha256', demoSecret)
                    .update(payload)
                    .digest('hex')
                const res = await app.fetch(
                    new Request('http://localhost/lease/request', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Signature-256': signature,
                        },
                        body: payload,
                    }),
                    demoEnv,
                )
                const body: any = await res.json()
                const gatePath = path.resolve(
                    edgeRoot(),
                    'apps/worker/src/middleware/authGate.ts',
                )
                const gate = require(gatePath)
                const vt0 = performance.now()
                const verifyOk = await gate.verifyHmacSignature(
                    demoSecret,
                    payload,
                    signature,
                )
                const verifyMs = performance.now() - vt0
                if (
                    res.status === 200 &&
                    body?.authenticatedRole === 'artist-viewport' &&
                    verifyOk &&
                    verifyMs < 5
                ) {
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: '>> [OK] [AUTH:GATE] Constant-time HMAC verified in <5ms',
                    })
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: `>> [OK] [AUTH:ROLE] Assigned scope [${body.authenticatedRole}]`,
                    })
                } else {
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: `:: [FAIL] [AUTH:REJECT] Unexpected auth probe result: ${res.status}`,
                    })
                }

                // 5. Negative control: tampered signature must fail closed
                const badSig = crypto
                    .createHmac('sha256', 'wrong_secret')
                    .update(payload)
                    .digest('hex')
                const badRes = await app.fetch(
                    new Request('http://localhost/lease/request', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Signature-256': badSig,
                        },
                        body: payload,
                    }),
                    demoEnv,
                )
                const badBody: any = await badRes.json()
                if (
                    badRes.status === 401 &&
                    badBody?.error?.code === 'UNAUTHORIZED_ACCESS'
                ) {
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: `:: [FAIL] [AUTH:REJECT] ${badBody.error.code}: ${badBody.error.message}`,
                    })
                }

                // 6. Negative control: command injection must fail closed
                const evilPayload = JSON.stringify({
                    sceneId: 'demo_sc01',
                    rawSql: 'DROP TABLE active_leases;',
                })
                const evilSig = crypto
                    .createHmac('sha256', demoSecret)
                    .update(evilPayload)
                    .digest('hex')
                const evilRes = await app.fetch(
                    new Request('http://localhost/synthesize', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Signature-256': evilSig,
                        },
                        body: evilPayload,
                    }),
                    demoEnv,
                )
                const evilBody: any = await evilRes.json()
                if (
                    evilRes.status === 403 &&
                    evilBody?.error?.code === 'FORBIDDEN_COMMAND_INJECTION'
                ) {
                    const keyMatch = /\[([^\]]+)\]/.exec(
                        evilBody.error.message || '',
                    )
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: `:: [FAIL] [INTENT:TRAP] ${evilBody.error.code}: [${keyMatch ? keyMatch[1] : 'unknown'}]`,
                    })
                }
            } catch (err: any) {
                const detail = (err?.message || 'auth probe failed').slice(
                    0,
                    120,
                )
                await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                    idx: 'cns00',
                    src: `:: [FAIL] [AUTH:REJECT] ${detail}`,
                })
            }

            // 7. Live hardware lease acquisition (real AudioLeaseDO actor)
            try {
                const doPath = path.resolve(
                    edgeRoot(),
                    'apps/worker/src/objects/AudioLeaseDO.ts',
                )
                const doMod = require(doPath)
                const tables: any = {
                    active_leases: [],
                    epoch_metadata: [{ id: 1, current_epoch: 1 }],
                }
                const mockSql = {
                    exec: (query: string, ...params: any[]) => {
                        const q = query.trim().toUpperCase()
                        if (q.startsWith('SELECT CURRENT_EPOCH')) {
                            return { toArray: () => [...tables.epoch_metadata] }
                        }
                        if (q.startsWith('SELECT * FROM ACTIVE_LEASES')) {
                            return { toArray: () => [...tables.active_leases] }
                        }
                        if (q.startsWith('INSERT INTO ACTIVE_LEASES')) {
                            tables.active_leases = [
                                {
                                    lease_id: params[0],
                                    holder_id: params[1],
                                    line_id: params[2],
                                    epoch: params[3],
                                    acquired_at_ms: params[4],
                                    heartbeat_at_ms: params[5],
                                    expires_at_ms: params[6],
                                },
                            ]
                            return { toArray: () => [] }
                        }
                        if (q.startsWith('DELETE FROM ACTIVE_LEASES')) {
                            tables.active_leases = []
                            return { toArray: () => [] }
                        }
                        if (q.startsWith('UPDATE EPOCH_METADATA')) {
                            tables.epoch_metadata[0].current_epoch = params[0]
                            return { toArray: () => [] }
                        }
                        if (q.startsWith('UPDATE ACTIVE_LEASES')) {
                            if (tables.active_leases[0]) {
                                tables.active_leases[0].heartbeat_at_ms =
                                    params[0]
                                tables.active_leases[0].expires_at_ms =
                                    params[1]
                            }
                            return { toArray: () => [] }
                        }
                        return { toArray: () => [] }
                    },
                }
                const mockState: any = {
                    storage: {
                        sql: mockSql,
                        setAlarm: async (ms: number) => {},
                        deleteAlarm: async () => {},
                    },
                }
                const leaseDO = new doMod.AudioLeaseDO(mockState, {})
                const postLease = (sub: string, payload: any) =>
                    leaseDO.fetch(
                        new Request(`http://localhost${sub}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                        }),
                    )

                const acqRes = await postLease('/lease/acquire', {
                    holderId: 'worker_rig1',
                    lineId: 'demo_line',
                })
                const acq: any = await acqRes.json()
                if (acqRes.status === 200 && acq?.status === 'LEASE_GRANTED') {
                    const ttlMs = acq.lease.expiresAtMs - acq.lease.acquiredAtMs
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: `>> [OK] [DO:MUTEX] Granted hardware lease [${acq.lease.leaseId}] (Epoch: ${acq.lease.epoch}, TTL: ${ttlMs}ms)`,
                    })

                    // 8. Heartbeat renewal
                    const hbRes = await postLease('/lease/heartbeat', {
                        leaseId: acq.lease.leaseId,
                        epoch: acq.lease.epoch,
                    })
                    const hb: any = await hbRes.json()
                    if (
                        hbRes.status === 200 &&
                        hb?.status === 'HEARTBEAT_ACKNOWLEDGED'
                    ) {
                        await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                            idx: 'cns00',
                            src: `>> [OK] [DO:HEARTBEAT] Heartbeat confirmed at epoch ${hb.epoch}. Deadline extended.`,
                        })
                    }

                    // 9. Negative control: concurrent acquisition must fail closed
                    const busyRes = await postLease('/lease/acquire', {
                        holderId: 'worker_rig2',
                        lineId: 'demo_line_2',
                    })
                    const busy: any = await busyRes.json()
                    if (
                        busyRes.status === 409 &&
                        busy?.error === 'HARDWARE_MUTEX_BUSY'
                    ) {
                        await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                            idx: 'cns00',
                            src: `:: [FAIL] [DO:MUTEX] ${busy.error}: ${busy.message}`,
                        })
                    }

                    // 10. Negative control: stale epoch must fail closed
                    const staleRes = await postLease('/lease/heartbeat', {
                        leaseId: acq.lease.leaseId,
                        epoch: acq.lease.epoch - 1,
                    })
                    const stale: any = await staleRes.json()
                    if (
                        staleRes.status === 409 &&
                        stale?.error === 'ZOMBIE_LEASE_EPOCH'
                    ) {
                        await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                            idx: 'cns00',
                            src: `:: [FAIL] [DO:FENCE] ${stale.error}: ${stale.message}`,
                        })
                    }
                }
            } catch (err: any) {
                const detail = (err?.message || 'lease probe failed').slice(
                    0,
                    120,
                )
                await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                    idx: 'cns00',
                    src: `:: [FAIL] [DO:MUTEX] ${detail}`,
                })
            }

            await new Promise((resolve) => setTimeout(resolve, 3000))
            break

        case '[FILTER: RUN SPECTRAL HYGIENE GAUNTLET]':
        case ' [FILTER: RUN SPECTRAL HYGIENE GAUNTLET]':
        case 'FILTER: RUN SPECTRAL HYGIENE GAUNTLET':
        case 'RUN SPECTRAL HYGIENE GAUNTLET':
            // 1. High-pass + DC strip audit over demo stem
            await ste.hunt(ActFlt.APPLY_SPECTRAL_FILTER, {
                idx: 'demo-spectral-filter',
                dat: {
                    filePath: 'demo/spectral_stem.wav',
                    pcmBuffer: demoSpectralStem(),
                },
            })

            // 2. Dynamic de-esser audit over demo stem
            await ste.hunt(ActDsr.APPLY_DYNAMIC_DEESSER, {
                idx: 'demo-spectral-deesser',
                dat: {
                    filePath: 'demo/spectral_stem.wav',
                    pcmBuffer: demoSpectralStem(),
                },
            })

            // 3. Negative control display
            await ste.hunt(ActFlt.APPLY_SPECTRAL_FILTER, {
                idx: 'demo-spectral-invalid',
            })

            await new Promise((resolve) => setTimeout(resolve, 3000))
            break

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
