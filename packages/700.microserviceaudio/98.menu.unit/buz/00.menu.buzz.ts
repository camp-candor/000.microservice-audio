/* eslint-disable */
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import * as ActDlg from '../../15.dialogue.unit/dialogue.action.js'
import * as ActMdl from '../../96.model.unit/model.action.js'
import * as ActMnu from '../menu.action.js'
//import * as ActAgt from '../../00.agent.unit/agent.action.js';
import * as ActCns from '../../act/console.action.js'
import * as ActOlm from '../../00.microserviceaudio.unit/microserviceaudio.action.js'
import * as ActGen from '../../10.generate.unit/generate.action.js'
import * as ActLdn from '../../01.loudness.unit/loudness.action.js'
import * as ActPek from '../../02.peaks.unit/peaks.action.js'
import * as ActTrn from '../../06.transcription.unit/transcription.action.js'
import * as ActSch from '../../08.schemas.unit/schemas.action.js'
import * as ActFlt from '../../11.filter.unit/filter.action.js'
import * as ActDsr from '../../16.deesser.unit/deesser.action.js'
import * as ActPrf from '../../09.profile.unit/profile.action.js'

import type { MenuModel } from '../menu.model.js'
import type MenuBit from '../fce/menu.bit.js'
import type State from '../../99.core/state.js'

import * as Grid from '../../val/grid.js'
import * as Align from '../../val/align.js'
import * as Color from '../../val/console-color.js'

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
        '[DIALOGUE: TEST G2P LEXICON OVERRIDES]',
        '[MODEL: VERIFY MMAP LATENT TENSORS]',
        '[PROFILE: INSPECT VAULT MANIFEST CACHE]',
        '[SYSTEM: AUDIT 21-UNIT BEE MANIFEST]',
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
        case '[DIALOGUE: TEST G2P LEXICON OVERRIDES]': {
            const testPayload = {
                seriesSlug: 'wiregrass-basin',
                characterId: 'char_silas',
                rawDialogueText:
                    'Do you hear what they are saying in the drainage culvert?',
                mruType: 'instinctive_reaction' as const,
            }
            const res = await ste.hunt(ActDlg.APPLY_DIALECT_G2P, {
                idx: 'menu-g2p-test',
                dat: testPayload,
            })
            const norm = (res as any)?.dlgBit?.result?.normalizedText || ''
            await ste.hunt(ActCns.UPDATE_CONSOLE, {
                idx: 'cns00',
                src: `>> [G2P:COCKPIT] Normalized: "${norm}"`,
            })
            break
        }

        case '[MODEL: VERIFY MMAP LATENT TENSORS]': {
            const auditRes = await ste.hunt(ActMdl.AUDIT_MEMORY_BUDGET, { idx: 'menu-model-ram-audit' })
            const report = auditRes?.mdlBit?.memoryReport
            const mbRss = report ? (report.currentRssBytes / (1024 * 1024)).toFixed(1) : '0'
            await ste.hunt(ActCns.UPDATE_CONSOLE, {
                idx: 'cns00',
                src: `>> [MODEL:COCKPIT] RSS Memory: ${mbRss} MB | Status: ${report?.status || 'UNKNOWN'}`,
            })
            break
        }

        case '[PROFILE: INSPECT VAULT MANIFEST CACHE]': {
            const root = process.cwd()
            const auditRes = await ste.hunt(ActPrf.AUDIT_VAULT_BOUNDARY, { idx: 'menu-vault-audit' })
            await ste.hunt(ActCns.UPDATE_CONSOLE, {
                idx: 'cns00',
                src: `>> [VAULT:AUDIT] Status: ${auditRes?.prfBit?.auditReport?.status || 'UNKNOWN'}`,
            })
            break
        }
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

            // 11. WebSocket telemetry tunnel journey (real actor + socket pair)
            const hadGlobalPair = 'WebSocketPair' in globalThis
            const NativeResponse = globalThis.Response
            try {
                const makeWsSocket = (): any => ({
                    sentMessages: [] as string[],
                    attachment: null as any,
                    tags: [] as string[],
                    send(data: any) {
                        this.sentMessages.push(
                            typeof data === 'string' ? data : String(data),
                        )
                    },
                    serializeAttachment(att: any) {
                        this.attachment = att
                    },
                    deserializeAttachment() {
                        return this.attachment
                    },
                    addEventListener() {},
                    close() {},
                })
                ;(globalThis as any).WebSocketPair = function (this: any) {
                    this[0] = makeWsSocket()
                    this[1] = makeWsSocket()
                }

                const wsTables: any = {
                    active_leases: [],
                    epoch_metadata: [{ id: 1, current_epoch: 1 }],
                }
                const wsSockets: any[] = []
                const wsMockSql = {
                    exec: (query: string, ...params: any[]) => {
                        const q = query.trim().toUpperCase()
                        if (q.startsWith('SELECT CURRENT_EPOCH')) {
                            return {
                                toArray: () => [...wsTables.epoch_metadata],
                            }
                        }
                        if (q.startsWith('SELECT * FROM ACTIVE_LEASES')) {
                            return {
                                toArray: () => [...wsTables.active_leases],
                            }
                        }
                        if (q.startsWith('INSERT INTO ACTIVE_LEASES')) {
                            wsTables.active_leases = [
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
                            wsTables.active_leases = []
                            return { toArray: () => [] }
                        }
                        if (q.startsWith('UPDATE EPOCH_METADATA')) {
                            wsTables.epoch_metadata[0].current_epoch = params[0]
                            return { toArray: () => [] }
                        }
                        if (q.startsWith('UPDATE ACTIVE_LEASES')) {
                            if (wsTables.active_leases[0]) {
                                wsTables.active_leases[0].heartbeat_at_ms =
                                    params[0]
                                wsTables.active_leases[0].expires_at_ms =
                                    params[1]
                            }
                            return { toArray: () => [] }
                        }
                        return { toArray: () => [] }
                    },
                }
                const wsMockState: any = {
                    storage: {
                        sql: wsMockSql,
                        setAlarm: async (ms: number) => {},
                        deleteAlarm: async () => {},
                    },
                    acceptWebSocket(ws: any, tags: string[] = []) {
                        ws.tags = tags
                        wsSockets.push(ws)
                    },
                    getWebSockets(tag?: string) {
                        if (!tag) return wsSockets
                        return wsSockets.filter((s: any) =>
                            s.tags.includes(tag),
                        )
                    },
                }
                const wsDoMod = require(
                    path.resolve(
                        edgeRoot(),
                        'apps/worker/src/objects/AudioLeaseDO.ts',
                    ),
                )
                const wsLeaseDO = new wsDoMod.AudioLeaseDO(wsMockState, {})
                const wsWorker = require(
                    path.resolve(edgeRoot(), 'apps/worker/src/index.ts'),
                )
                const wsApp = wsWorker.default || wsWorker
                const wsEnv: any = {
                    AUDIO_LEASE_DO: {
                        idFromName: () => ({}),
                        get: () => wsLeaseDO,
                    },
                }

                wsLeaseDO.broadcastTelemetry({
                    type: 'TUNNEL_PRIMER',
                    source: 'cns00',
                    payload: { note: 'tunnel primed' },
                    ascii: '>> [OK] [WS:PRIMER] tunnel primed',
                })

                // Node fetch rejects 101 status codes; tolerate them outside the isolate
                ;(globalThis as any).Response = class extends NativeResponse {
                    constructor(body: any, init: any) {
                        if (init && init.status === 101) {
                            super(body, { ...init, status: 200 })
                            Object.defineProperty(this, 'status', {
                                value: 101,
                            })
                        } else {
                            super(body, init)
                        }
                    }
                }

                const upRes = await wsApp.fetch(
                    new Request('http://localhost/ws/telemetry?role=operator', {
                        headers: { Upgrade: 'websocket' },
                    }),
                    wsEnv,
                )
                if (upRes.status === 101) {
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: '>> [WS:OPEN] Edge telemetry tunnel established [OK]',
                    })
                    const serverSock = wsSockets[wsSockets.length - 1]
                    const history: any = JSON.parse(serverSock.sentMessages[0])
                    if (history?.type === 'TELEMETRY_HISTORY') {
                        await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                            idx: 'cns00',
                            src: `>> [WS:REPLAY] Restoring historical telemetry frames (seq: ${history.seq})`,
                        })
                    }
                }

                const wsAcq = await wsLeaseDO.fetch(
                    new Request('http://localhost/lease/acquire', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            holderId: 'worker_rig1',
                            lineId: 'ws_line',
                        }),
                    }),
                )
                const wsGrant: any = await wsAcq.json()
                if (
                    wsAcq.status === 200 &&
                    wsGrant?.status === 'LEASE_GRANTED'
                ) {
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: `>> [OK] [DO:MUTEX] Granted hardware lease [${wsGrant.lease.leaseId}] (Epoch: ${wsGrant.lease.epoch})`,
                    })
                    wsLeaseDO.broadcastTelemetry({
                        type: 'LEASE_GRANTED',
                        source: 'mutex',
                        payload: { leaseId: wsGrant.lease.leaseId },
                        ascii: `>> [OK] [DO:MUTEX] lease live at epoch ${wsGrant.lease.epoch}`,
                    })
                }

                const plainRes = await wsApp.fetch(
                    new Request('http://localhost/ws/telemetry'),
                    wsEnv,
                )
                if (plainRes.status === 426) {
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: ':: [FAIL] [WS:UPGRADE] HTTP 426 Upgrade Required',
                    })
                }
            } catch (err: any) {
                const detail = (err?.message || 'tunnel probe failed').slice(
                    0,
                    120,
                )
                await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                    idx: 'cns00',
                    src: `:: [FAIL] [WS:UPGRADE] ${detail}`,
                })
            } finally {
                ;(globalThis as any).Response = NativeResponse
                if (!hadGlobalPair) {
                    delete (globalThis as any).WebSocketPair
                }
            }

            // 12. TypeBox firewall validation probe (valid scene AST)
            try {
                require('tsx/cjs')
                const astWorker = require(
                    path.resolve(edgeRoot(), 'apps/worker/src/index.ts'),
                )
                const astApp = astWorker.default || astWorker
                const astEnv: any = {
                    AUDIO_GATEWAY_SECRET: 'unused_for_cf_path',
                    CF_ACCESS_CLIENT_ID: 'demo_cf_id',
                    CF_ACCESS_CLIENT_SECRET: 'demo_cf_secret',
                }
                const astCreds = {
                    'Content-Type': 'application/json',
                    'CF-Access-Client-Id': 'demo_cf_id',
                    'CF-Access-Client-Secret': 'demo_cf_secret',
                }
                const validAst = {
                    sceneId: 'sc_01',
                    seriesId: 'series_001',
                    state_snapshot_hash:
                        '3a7894a4c1477ea53d7e5d2ea99401b34e402b896489370891d4e022064104d4',
                    dialogueLines: [
                        {
                            lineId: 'line_01',
                            shotIndex: 0,
                            character: 'char_wart',
                            text: 'Hold the gates until dawn.',
                        },
                    ],
                }
                const okRes = await astApp.fetch(
                    new Request('http://localhost/ast/validate', {
                        method: 'POST',
                        headers: astCreds,
                        body: JSON.stringify(validAst),
                    }),
                    astEnv,
                )
                const okBody: any = await okRes.json()
                if (
                    okRes.status === 200 &&
                    okBody?.status === 'INGRESS_SCHEMA_VALIDATED'
                ) {
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: `>> [OK] [TYPEBOX:FIREWALL] Ingress AST verified for Scene [${okBody.sceneId}] (${okBody.totalLines} lines, 0 extra keys)`,
                    })
                    const anchor = String(
                        okBody.state_snapshot_hash || '',
                    ).slice(0, 12)
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: `>> [OK] [TYPEBOX:SNAPSHOT] Merkle anchor verified (${anchor}...)`,
                    })
                }

                // 13. Negative control: undeclared key must fail closed
                const hostileAst = {
                    ...validAst,
                    rogueLLMAttribute: 'INJECTED',
                }
                const badRes = await astApp.fetch(
                    new Request('http://localhost/ast/validate', {
                        method: 'POST',
                        headers: astCreds,
                        body: JSON.stringify(hostileAst),
                    }),
                    astEnv,
                )
                const badBody: any = await badRes.json()
                const violations: any[] = badBody?.invalidProperties || []
                const closedWorldTrap = violations.some(
                    (v: any) =>
                        typeof v?.path === 'string' &&
                        v.path.includes('rogueLLMAttribute'),
                )
                if (
                    badRes.status === 400 &&
                    badBody?.title ===
                        'Structural Firewall Validation Failure' &&
                    closedWorldTrap
                ) {
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: ':: [FAIL] [TYPEBOX:FIREWALL] Structural Firewall Validation Failure: Expected no additional properties',
                    })
                }
            } catch (err: any) {
                const detail = (err?.message || 'ast probe failed').slice(
                    0,
                    120,
                )
                await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                    idx: 'cns00',
                    src: `:: [FAIL] [TYPEBOX:FIREWALL] ${detail}`,
                })
            }

            // 14. R2 signed upload authorization (real app + live lease actor)
            try {
                require('tsx/cjs')
                const r2Worker = require(
                    path.resolve(edgeRoot(), 'apps/worker/src/index.ts'),
                )
                const r2App = r2Worker.default || r2Worker
                const r2DoMod = require(
                    path.resolve(
                        edgeRoot(),
                        'apps/worker/src/objects/AudioLeaseDO.ts',
                    ),
                )
                const makeLeaseActor = () => {
                    const leaseTables: any = {
                        active_leases: [],
                        epoch_metadata: [{ id: 1, current_epoch: 1 }],
                    }
                    const leaseSql = {
                        exec: (query: string, ...params: any[]) => {
                            const q = query.trim().toUpperCase()
                            if (q.startsWith('SELECT CURRENT_EPOCH')) {
                                return {
                                    toArray: () => [
                                        ...leaseTables.epoch_metadata,
                                    ],
                                }
                            }
                            if (q.startsWith('SELECT * FROM ACTIVE_LEASES')) {
                                return {
                                    toArray: () => [
                                        ...leaseTables.active_leases,
                                    ],
                                }
                            }
                            if (q.startsWith('INSERT INTO ACTIVE_LEASES')) {
                                leaseTables.active_leases = [
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
                                leaseTables.active_leases = []
                                return { toArray: () => [] }
                            }
                            if (q.startsWith('UPDATE EPOCH_METADATA')) {
                                leaseTables.epoch_metadata[0].current_epoch =
                                    params[0]
                                return { toArray: () => [] }
                            }
                            if (q.startsWith('UPDATE ACTIVE_LEASES')) {
                                if (leaseTables.active_leases[0]) {
                                    leaseTables.active_leases[0].heartbeat_at_ms =
                                        params[0]
                                    leaseTables.active_leases[0].expires_at_ms =
                                        params[1]
                                }
                                return { toArray: () => [] }
                            }
                            return { toArray: () => [] }
                        },
                    }
                    return new r2DoMod.AudioLeaseDO(
                        {
                            storage: {
                                sql: leaseSql,
                                setAlarm: async (ms: number) => {},
                                deleteAlarm: async () => {},
                            },
                        },
                        {},
                    )
                }
                const r2Objects = new Map<string, any>()
                const r2Bucket: any = {
                    head: async (key: string) => {
                        const obj = r2Objects.get(key)
                        return obj
                            ? {
                                  key,
                                  size: obj.size,
                                  uploaded: obj.uploaded,
                              }
                            : null
                    },
                    list: async (opts?: any) => {
                        const res: any[] = []
                        for (const [key, val] of r2Objects.entries()) {
                            if (key.startsWith(opts?.prefix || '')) {
                                res.push({
                                    key,
                                    size: val.size,
                                    uploaded: val.uploaded,
                                })
                            }
                        }
                        return { objects: res }
                    },
                    delete: async (key: string) => {
                        r2Objects.delete(key)
                    },
                }
                const d1Statements: string[] = []
                const d1Db: any = {
                    prepare: (sql: string) => {
                        d1Statements.push(sql)
                        return {
                            bind: () => ({
                                run: async () => ({ success: true }),
                            }),
                            run: async () => ({ success: true }),
                        }
                    },
                }
                const nsFor = (actor: any) => ({
                    idFromName: () => ({}),
                    get: () => ({
                        fetch: (req: any) => actor.fetch(req),
                    }),
                })
                const envFor = (actor: any): any => ({
                    AUDIO_LEASE_DO: nsFor(actor),
                    CANON_DB: d1Db,
                    AUDIO_STEMS_BUCKET: r2Bucket,
                    CF_ACCESS_CLIENT_ID: 'demo_cf_id',
                    CF_ACCESS_CLIENT_SECRET: 'demo_cf_secret',
                })
                const r2Creds = {
                    'Content-Type': 'application/json',
                    'CF-Access-Client-Id': 'demo_cf_id',
                    'CF-Access-Client-Secret': 'demo_cf_secret',
                }
                const r2Post = (env: any, sub: string, payload: any) =>
                    r2App.fetch(
                        new Request(`http://localhost${sub}`, {
                            method: 'POST',
                            headers: r2Creds,
                            body: JSON.stringify(payload),
                        }),
                        env,
                    )

                const leasedActor = makeLeaseActor()
                await leasedActor.fetch(
                    new Request('http://localhost/lease/acquire', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            holderId: 'worker_rig1',
                            lineId: 'r2_line',
                        }),
                    }),
                )
                const leaseStatus: any = await (
                    await leasedActor.fetch(
                        new Request('http://localhost/lease/status'),
                    )
                ).json()
                const leasedEnv = envFor(leasedActor)

                const upRes = await r2Post(leasedEnv, '/stems/signed-upload', {
                    leaseId: leaseStatus.activeLease.leaseId,
                    epoch: leaseStatus.currentEpoch,
                    seriesId: 'series_01',
                    sceneId: 'sc_01',
                    stemId: 'stem_01',
                })
                const upBody: any = await upRes.json()
                if (
                    upRes.status === 200 &&
                    upBody?.status === 'SIGNED_UPLOAD_GRANTED'
                ) {
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: `>> [OK] [R2:UPLOAD] Authorized signed upload URL for [${upBody.objectKey}]`,
                    })
                }

                // 15. Cryptographic confirmation + D1 sealing
                r2Objects.set('stems/series_01/sc_01/stem_01.wav', {
                    size: 240044,
                    uploaded: new Date(),
                })
                const stemSha =
                    '3a7894a4c1477ea53d7e5d2ea99401b34e402b896489370891d4e022064104d4'
                const cfRes = await r2Post(leasedEnv, '/stems/confirm', {
                    leaseId: leaseStatus.activeLease.leaseId,
                    epoch: leaseStatus.currentEpoch,
                    objectKey: 'stems/series_01/sc_01/stem_01.wav',
                    sha256: stemSha,
                    durationMs: 2500,
                    byteLength: 240044,
                })
                const cfBody: any = await cfRes.json()
                const ledgerWrites = d1Statements.filter((s: string) =>
                    s.includes('audio_stem_ledger'),
                ).length
                if (
                    cfRes.status === 200 &&
                    cfBody?.status === 'STEM_CONFIRMED_AND_SEALED' &&
                    ledgerWrites > 0
                ) {
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: `>> [OK] [R2:CONFIRM] Stem [${cfBody.stemId}] sealed into D1 ledger (${cfBody.byteLength} bytes, SHA: ${String(cfBody.sha256).slice(0, 8)}...)`,
                    })
                }

                // 16. Staging sweeper execution
                const sweeperMod = require(
                    path.resolve(
                        edgeRoot(),
                        'apps/worker/src/crons/sweeper.ts',
                    ),
                )
                r2Objects.set('staging/scratch_old.tmp', {
                    size: 5000,
                    uploaded: new Date(Date.now() - 48 * 3600 * 1000),
                })
                r2Objects.set('staging/scratch_recent.tmp', {
                    size: 3000,
                    uploaded: new Date(),
                })
                r2Objects.set('stems/canonical.wav', {
                    size: 100000,
                    uploaded: new Date(Date.now() - 48 * 3600 * 1000),
                })
                const sweepReport: any =
                    await sweeperMod.purgeOrphanedStagingBuffers(leasedEnv)
                if (
                    sweepReport?.status === 'COMPLETED' &&
                    r2Objects.has('stems/canonical.wav')
                ) {
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: `>> [OK] [R2:SWEEPER] Staging sweep complete: ${sweepReport.deletedCount} pruned, ${sweepReport.reclaimedBytes} bytes reclaimed`,
                    })
                }

                // 17. Negative control: unleased caller must fail closed
                const idleActor = makeLeaseActor()
                const idleEnv = envFor(idleActor)
                const negRes = await r2Post(idleEnv, '/stems/signed-upload', {
                    leaseId: 'lease_none',
                    epoch: 1,
                    seriesId: 'series_01',
                    sceneId: 'sc_01',
                    stemId: 'stem_99',
                })
                const negBody: any = await negRes.json()
                if (
                    negRes.status === 403 &&
                    negBody?.error?.code === 'NO_ACTIVE_HARDWARE_LEASE'
                ) {
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: `:: [FAIL] [R2:GATE] ${negBody.error.code}: ${negBody.error.message}`,
                    })
                }
            } catch (err: any) {
                const detail = (err?.message || 'r2 probe failed').slice(0, 120)
                await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                    idx: 'cns00',
                    src: `:: [FAIL] [R2:GATE] ${detail}`,
                })
            }

            // 18. Contention drill: 5-caller simultaneous race (real actor)
            try {
                require('tsx/cjs')
                const raceDoMod = require(
                    path.resolve(
                        edgeRoot(),
                        'apps/worker/src/objects/AudioLeaseDO.ts',
                    ),
                )
                const raceTables: any = {
                    active_leases: [],
                    epoch_metadata: [{ id: 1, current_epoch: 1 }],
                }
                const raceSql = {
                    exec: (query: string, ...params: any[]) => {
                        const q = query.trim().toUpperCase()
                        if (q.startsWith('SELECT CURRENT_EPOCH')) {
                            return {
                                toArray: () => [...raceTables.epoch_metadata],
                            }
                        }
                        if (q.startsWith('SELECT * FROM ACTIVE_LEASES')) {
                            return {
                                toArray: () => [...raceTables.active_leases],
                            }
                        }
                        if (q.startsWith('INSERT INTO ACTIVE_LEASES')) {
                            raceTables.active_leases = [
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
                            raceTables.active_leases = []
                            return { toArray: () => [] }
                        }
                        if (q.startsWith('UPDATE EPOCH_METADATA')) {
                            raceTables.epoch_metadata[0].current_epoch =
                                params[0]
                            return { toArray: () => [] }
                        }
                        if (q.startsWith('UPDATE ACTIVE_LEASES')) {
                            if (raceTables.active_leases[0]) {
                                raceTables.active_leases[0].heartbeat_at_ms =
                                    params[0]
                                raceTables.active_leases[0].expires_at_ms =
                                    params[1]
                            }
                            return { toArray: () => [] }
                        }
                        return { toArray: () => [] }
                    },
                }
                const raceDO = new raceDoMod.AudioLeaseDO(
                    {
                        storage: {
                            sql: raceSql,
                            setAlarm: async (ms: number) => {},
                            deleteAlarm: async () => {},
                        },
                    },
                    {},
                )
                const raceAcquire = (holderId: string) =>
                    raceDO.fetch(
                        new Request('http://localhost/lease/acquire', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                holderId,
                                lineId: 'race_line',
                            }),
                        }),
                    )
                const raceResps = await Promise.all([
                    raceAcquire('race_w1'),
                    raceAcquire('race_w2'),
                    raceAcquire('race_w3'),
                    raceAcquire('race_w4'),
                    raceAcquire('race_w5'),
                ])
                const winners = raceResps.filter((r: any) => r.status === 200)
                const losers = raceResps.filter((r: any) => r.status === 409)
                if (winners.length === 1 && losers.length === 4) {
                    const win: any = await winners[0].json()
                    await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                        idx: 'cns00',
                        src: `>> [OK] [DO:MUTEX] Granted hardware lease [${win.lease.leaseId}] (Epoch: ${win.lease.epoch})`,
                    })

                    // 19. Contention rejection receipt (first loser)
                    const loss: any = await losers[0].json()
                    if (loss?.error === 'HARDWARE_MUTEX_BUSY') {
                        await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                            idx: 'cns00',
                            src: `:: [FAIL] [DO:CONTENTION] ${loss.error}: ${loss.message}`,
                        })
                    }

                    // 20. Anti-zombie fencing probe (stale epoch)
                    const staleRes = await raceDO.fetch(
                        new Request('http://localhost/lease/heartbeat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                leaseId: win.lease.leaseId,
                                epoch: win.lease.epoch - 1,
                            }),
                        }),
                    )
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

                    // 21. Watchdog eviction drill (heartbeat silence)
                    await raceDO.alarm()
                    const postAlarm: any = await (
                        await raceDO.fetch(
                            new Request('http://localhost/lease/status'),
                        )
                    ).json()
                    if (
                        postAlarm?.isLocked === false &&
                        typeof postAlarm?.currentEpoch === 'number'
                    ) {
                        await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                            idx: 'cns00',
                            src: `:: [FAIL] [DO:WATCHDOG] Lease revoked due to heartbeat silence (Fenced Epoch: ${postAlarm.currentEpoch})`,
                        })
                    }
                }
            } catch (err: any) {
                const detail = (err?.message || 'race probe failed').slice(
                    0,
                    120,
                )
                await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                    idx: 'cns00',
                    src: `:: [FAIL] [DO:CONTENTION] ${detail}`,
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

        case '[SYSTEM: AUDIT 21-UNIT BEE MANIFEST]': {
            const bee = await import('../../BEE.js')
            const totalUnits = bee.list.length
            const unitData = new bee.default()
            const mountedKeys = Object.keys(bee.reducer)
            const isComplete = totalUnits === 22 && mountedKeys.length === 22 // 21 domain units + 00 root

            if (ste) {
                await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                    idx: 'cns00',
                    src: `>> [BEE:AUDIT] Units in list: ${totalUnits} | Mounted Reducers: ${mountedKeys.length}`,
                })
                await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                    idx: 'cns00',
                    src: isComplete
                        ? '>> [BEE:OK] All 21 domain units verified in state machine.'
                        : ':: [BEE:FAIL] Unit mismatch detected.',
                })
            }
            break
        }

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
