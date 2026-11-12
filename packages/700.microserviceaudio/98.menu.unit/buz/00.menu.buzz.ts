import * as ActMnu from '../menu.action.js'
import * as ActCns from '../../act/console.action.js'
import * as ActChc from '../../act/choice.action.js'
import * as ActGrd from '../../act/grid.action.js'
import * as ActWrt from '../../act/console.action.js'
import * as ActBus from '../../99.bus.unit/bus.action.js'
import * as ActPpl from '../../03.pipeline.unit/pipeline.action.js'
import * as ActCmp from '../../17.composition.unit/composition.action.js'
import * as ActClc from '../../97.collect.unit/collect.action.js'
import * as ActVrf from '../../05.verification.unit/verification.action.js'
import * as ActLdn from '../../01.loudness.unit/loudness.action.js'
import * as ActAud from '../../13.audio.unit/audio.action.js'
import * as ActGen from '../../10.generate.unit/generate.action.js'
import { MenuModel } from '../menu.model.js'
import type MenuBit from '../fce/menu.bit.js'
import type State from '../../99.core/state.js'

let rootSlv: ((val: any) => void) | null = null

const UPDATE_CONSOLE = '[Console action] Update Console'

export const CHOICE_TOOLTIPS: Record<string, string> = {
    '[BUS: VERIFY 7-BIT ASCII TELEMETRY]':
        'Sanitize probe telemetry through 99.bus.unit and verify zero multi-byte UTF-8 glyphs reach cns00.',
    '[PIPELINE: RUN 10-UNIT SYNTHESIS SEQUENCE]':
        'Execute full 10-stage deterministic synthesis pipeline with T0=$0.00 pre-flight guards and 4n+1 frame alignment.',
    '[COMPOSE: BUILD VISEME LATTICE SIDECAR]':
        'Quantize millisecond audio duration via ceiling math to 24fps Preston Blair viseme keyframes.',
    '[COLLECT: SEAL STEM RECEIPT LEDGER]':
        'Compute 64-char SHA-256 binary digest and exact PCM millisecond duration for WAV stems.',
    '[VERIFY: RUN 6-STAGE SIGNAL FIREWALL]':
        'Run sequential 6-gate signal hygiene and broadcast conformance audit with fail-closed quarantine.',
    '[LOUDNESS: CALIBRATE TWO-PASS STEM]':
        'Calibrate PCM stem to -16.0 LUFS web target across two passes with -1.0 dBTP clipping guard.',
    '[CADENCE: AUDIT BLIND CHARACTER RHYTHM]':
        'Evaluate timbre-agnostic rhythmic cadence confidence (P >= 0.95) and -60.0 dBFS noise floor.',
    'ROOT MENU':
        'Exit MICROSERVICEAUDIO MENU cleanly and return control to root terminal switchboard.',
}

export const streamMenuTooltip = async (
    ste: State | undefined,
    focusedChoice: string,
): Promise<void> => {
    const tip =
        CHOICE_TOOLTIPS[focusedChoice] ||
        `Operational command: ${focusedChoice}`
    if (ste && typeof ste.hunt === 'function') {
        await ste
            .hunt(ActBus.EMIT_ASCII_TELEMETRY, {
                idx: 'menu-tooltip',
                dat: {
                    level: 'TOOLTIP',
                    sinkIdx: 'cns00',
                    message: `[TOOLTIP] ${focusedChoice} -> ${tip}`,
                },
            })
            .catch(() => {})
    }
}

export const initMenu = async (
    cpy: MenuModel,
    bal: MenuBit,
    ste?: State,
): Promise<MenuModel> => {
    if (bal == null) bal = { idx: 'init-menu', slv: () => {} }
    rootSlv = (bal.slv as (val: any) => void) || null

    if (
        !ste ||
        typeof ste.hunt !== 'function' ||
        !(globalThis as any).LIBRARY
    ) {
        // Headless CI degradation safety
        if (bal.slv) bal.slv({ mnuBit: { idx: 'init-menu', val: 1 } })
        return cpy
    }

    const gridConsole = await global.LIBRARY.hunt(ActGrd.UPDATE_GRID, {
        x: 4,
        y: 0,
        xSpan: 8,
        ySpan: 12,
    })
    // Library-owned actions (Update Grid / Write Console / Open Choice) must be
    // hunted on the master LIBRARY bus; hunting them on the package bus never
    // settles (no library handler/slv attached) and the menu boot hangs before
    // any widget mounts.
    await global.LIBRARY.hunt(ActWrt.WRITE_CONSOLE, {
        idx: 'cns00',
        dat: { net: gridConsole?.grdBit?.dat, src: 'alligator0' },
    })

    await ste.hunt(ActBus.EMIT_ASCII_TELEMETRY, {
        idx: 'menu-boot-banner',
        dat: {
            level: 'OK',
            sinkIdx: 'cns00',
            message:
                '[COCKPIT] 000.MICROSERVICE-AUDIO 12x12 ASCII BUS ONLINE (T0 = $0.00)',
        },
    })

    await updateMenu(cpy, bal, ste)
    return cpy
}

export const updateMenu = async (
    cpy: MenuModel,
    bal: MenuBit,
    ste?: State,
): Promise<MenuModel> => {
    if (
        !ste ||
        typeof ste.hunt !== 'function' ||
        !(globalThis as any).LIBRARY
    ) {
        if (bal?.slv) bal.slv({ mnuBit: { idx: 'update-menu', val: 1 } })
        return cpy
    }

    const lst = [
        '[BUS: VERIFY 7-BIT ASCII TELEMETRY]',
        '[PIPELINE: RUN 10-UNIT SYNTHESIS SEQUENCE]',
        '[COMPOSE: BUILD VISEME LATTICE SIDECAR]',
        '[COLLECT: SEAL STEM RECEIPT LEDGER]',
        '[VERIFY: RUN 6-STAGE SIGNAL FIREWALL]',
        '[LOUDNESS: CALIBRATE TWO-PASS STEM]',
        '[CADENCE: AUDIT BLIND CHARACTER RHYTHM]',
        'ROOT MENU',
    ]

    const gridChoice = await global.LIBRARY.hunt(ActGrd.UPDATE_GRID, {
        x: 0,
        y: 4,
        xSpan: 4,
        ySpan: 8,
    })

    // Library-owned actions (Update Grid / Write Console / Open Choice) must be
    // hunted on the master LIBRARY bus; hunting them on the package bus never
    // settles (no library handler/slv attached) and no choice form ever mounts.
    const choiceRes = await global.LIBRARY.hunt(ActChc.OPEN_CHOICE, {
        dat: {
            clr0: 'black',
            clr1: 'yellow',
            cb: (focused: string) => {
                void streamMenuTooltip(ste, focused)
            },
        },
        src: 'vertical',
        lst,
        net: gridChoice?.grdBit?.dat,
    })

    const src: string = choiceRes?.chcBit?.src || 'ROOT MENU'

    switch (src) {
        case '[BUS: VERIFY 7-BIT ASCII TELEMETRY]': {
            const probeRes = await ste.hunt(ActBus.EMIT_ASCII_TELEMETRY, {
                idx: 'menu-bus-probe',
                dat: {
                    level: 'OK',
                    sinkIdx: 'cns00',
                    message:
                        '[BUS] 7-Bit Clean ASCII Telemetry Bus Verified (0 multi-byte glyphs)',
                },
            })
            // Library-owned console actions must be hunted on the master LIBRARY
            // bus; hunting them on the package bus never settles.
            await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                idx: 'cns00',
                src: `>> [BUS:COCKPIT] Bytes=${probeRes?.busBit?.envelope?.sanitizedByteCount ?? 0} | Stripped=${probeRes?.busBit?.envelope?.strippedNonAsciiCount ?? 0}`,
            })
            break
        }

        case '[PIPELINE: RUN 10-UNIT SYNTHESIS SEQUENCE]': {
            const os = await import('node:os')
            const path = await import('node:path')
            const wavOut = path.join(
                os.tmpdir(),
                'cockpit_pipeline_ep01_sc01_ln01.wav',
            )
            const res = await ste.hunt(ActPpl.EXECUTE_SYNTHESIS_PIPELINE, {
                idx: 'menu-pipeline-seq',
                dat: {
                    lineId: 'ep01_sc01_ln01',
                    seriesSlug: 'wiregrass-basin',
                    characterId: 'char_silas',
                    rawDialogueText: 'Stand your ground.',
                    outputWavPath: wavOut,
                    mruType: 'stimulus',
                },
            })
            const report = res?.pplBit?.report
            await ste.hunt(ActBus.EMIT_ASCII_TELEMETRY, {
                idx: 'menu-pipeline-receipt',
                dat: {
                    level: 'OK',
                    sinkIdx: 'cns00',
                    message: `[PIPELINE:COCKPIT] Verdict: ${report?.status || 'UNKNOWN'} (${report?.stagesCompletedCount ?? 0}/10 stages) | 4n+1=${report?.causalVaeFrames ?? 0}`,
                },
            })
            break
        }

        case '[COMPOSE: BUILD VISEME LATTICE SIDECAR]': {
            const res = await ste.hunt(ActCmp.BUILD_VISEME_SIDECAR, {
                idx: 'menu-viseme-sidecar',
                dat: {
                    lineId: 'ep01_sc01_ln01',
                    characterId: 'char_silas',
                    stemSha256:
                        'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
                    normalizedDialogueText: 'Stand your ground.',
                    audioDurationMs: 1500,
                    leadSilenceMs: 125,
                    tailSilenceMs: 125,
                    fps: 24,
                },
            })
            const sidecar = res?.cmpBit?.sidecar
            await ste.hunt(ActBus.EMIT_ASCII_TELEMETRY, {
                idx: 'menu-compose-receipt',
                dat: {
                    level: 'OK',
                    sinkIdx: 'cns00',
                    message: `[COMPOSE:COCKPIT] Sidecar [${sidecar?.lineId || 'unknown'}] | Frames: ${sidecar?.totalAllocatedFrames ?? 0} | Keyframes: ${sidecar?.keyframes?.length ?? 0}`,
                },
            })
            break
        }

        case '[COLLECT: SEAL STEM RECEIPT LEDGER]': {
            const sampleRate = 48000
            const bytesPerSample = 3
            const numSamples = Math.round(sampleRate * 1.5)
            const dataBytes = numSamples * bytesPerSample
            const wav = Buffer.alloc(44 + dataBytes)
            wav.write('RIFF', 0, 'ascii')
            wav.writeUInt32LE(36 + dataBytes, 4)
            wav.write('WAVE', 8, 'ascii')
            wav.write('fmt ', 12, 'ascii')
            wav.writeUInt32LE(16, 16)
            wav.writeUInt16LE(1, 20)
            wav.writeUInt16LE(1, 22)
            wav.writeUInt32LE(sampleRate, 24)
            wav.writeUInt32LE(sampleRate * bytesPerSample, 28)
            wav.writeUInt16LE(bytesPerSample, 32)
            wav.writeUInt16LE(24, 34)
            wav.write('data', 36, 'ascii')
            wav.writeUInt32LE(dataBytes, 40)

            const res = await ste.hunt(ActClc.SEAL_STEM_RECEIPT, {
                idx: 'menu-collect-seal',
                dat: {
                    lineId: 'ep01_sc01_ln01',
                    filePath: 'scratch/audio/ep01_sc01_ln01.wav',
                    pcmBuffer: wav,
                    measuredLufs: -16.0,
                    measuredPeakDbTp: -1.4,
                },
            })
            const receipt = res?.clcBit?.receipt
            await ste.hunt(ActBus.EMIT_ASCII_TELEMETRY, {
                idx: 'menu-collect-receipt',
                dat: {
                    level: 'OK',
                    sinkIdx: 'cns00',
                    message: `[COLLECT:COCKPIT] Sealed [${receipt?.lineId || 'unknown'}] | Duration: ${receipt?.durationMs ?? 0}ms | SHA256: ${receipt?.sha256Hash?.slice(0, 12) || 'none'}...`,
                },
            })
            break
        }

        case '[VERIFY: RUN 6-STAGE SIGNAL FIREWALL]': {
            const sampleRate = 48000
            const dataBytes = sampleRate * 2
            const wav = Buffer.alloc(44 + dataBytes)
            wav.write('RIFF', 0, 'ascii')
            wav.writeUInt32LE(36 + dataBytes, 4)
            wav.write('WAVE', 8, 'ascii')
            wav.write('fmt ', 12, 'ascii')
            wav.writeUInt32LE(16, 16)
            wav.writeUInt16LE(1, 20)
            wav.writeUInt16LE(1, 22)
            wav.writeUInt32LE(sampleRate, 24)
            wav.writeUInt32LE(sampleRate * 2, 28)
            wav.writeUInt16LE(2, 32)
            wav.writeUInt16LE(16, 34)
            wav.write('data', 36, 'ascii')
            wav.writeUInt32LE(dataBytes, 40)
            for (let i = 0; i < sampleRate; i++) {
                const val =
                    i < 38400
                        ? Math.round(
                              Math.sin((2 * Math.PI * 440 * i) / sampleRate) *
                                  8500,
                          )
                        : 0
                wav.writeInt16LE(val, 44 + i * 2)
            }
            const res = await ste.hunt(ActVrf.RUN_CONFORMANCE_FIREWALL, {
                idx: 'menu-verify-firewall',
                dat: {
                    filePath: 'cockpit_6stage_probe.wav',
                    expectedText: 'Stand your ground.',
                    pcmBuffer: wav,
                    sampleRateHz: sampleRate,
                    // Conforming take: the HPF + deesser stages attenuate the
                    // 0.8s burst ~4.5 dB, landing at ~ -19.7 LUFS, so target
                    // must be -19.5 (+/-1.0) to certify 6/6 gates (mirrors
                    // val/verificationFirewall.test.ts).
                    targetLufs: -19.5,
                    toleranceLufs: 1.0,
                    maxTruePeakDbTp: -1.0,
                    noiseFloorCeilingDbfs: -60.0,
                    unlinkOnFailure: false,
                },
            })
            const report = res?.vrfBit?.report
            await ste.hunt(ActBus.EMIT_ASCII_TELEMETRY, {
                idx: 'menu-verify-receipt',
                dat: {
                    level: 'OK',
                    sinkIdx: 'cns00',
                    message: `[VERIFY:COCKPIT] Firewall Verdict: ${report?.status || 'UNKNOWN'} (${report?.gatesPassedCount ?? 0}/6 gates)`,
                },
            })
            break
        }

        case '[LOUDNESS: CALIBRATE TWO-PASS STEM]': {
            const sampleRate = 48000
            const dataBytes = sampleRate * 2
            const wav = Buffer.alloc(44 + dataBytes)
            wav.write('RIFF', 0, 'ascii')
            wav.writeUInt32LE(36 + dataBytes, 4)
            wav.write('WAVE', 8, 'ascii')
            wav.write('fmt ', 12, 'ascii')
            wav.writeUInt32LE(16, 16)
            wav.writeUInt16LE(1, 20)
            wav.writeUInt16LE(1, 22)
            wav.writeUInt32LE(sampleRate, 24)
            wav.writeUInt32LE(sampleRate * 2, 28)
            wav.writeUInt16LE(2, 32)
            wav.writeUInt16LE(16, 34)
            wav.write('data', 36, 'ascii')
            wav.writeUInt32LE(dataBytes, 40)
            for (let i = 0; i < sampleRate; i++) {
                const val = Math.round(
                    Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 3276,
                )
                wav.writeInt16LE(val, 44 + i * 2)
            }
            const res = await ste.hunt(ActLdn.CALIBRATE_LOUDNESS_TWO_PASS, {
                idx: 'menu-loudness-calibrate',
                dat: {
                    filePath: 'cockpit_synthetic_stem.wav',
                    pcmBuffer: wav,
                    profile: {
                        targetLufs: -16.0,
                        toleranceLufs: 1.0,
                        maxTruePeakDbTp: -1.0,
                    },
                },
            })
            const report = res?.ldnBit?.calibrationResult
            await ste.hunt(ActBus.EMIT_ASCII_TELEMETRY, {
                idx: 'menu-loudness-receipt',
                dat: {
                    level: 'OK',
                    sinkIdx: 'cns00',
                    message: `[LOUDNESS:COCKPIT] Status: ${report?.status || 'UNKNOWN'} | Calibrated: ${report?.pass2CalibratedLufs ?? -99} LUFS`,
                },
            })
            break
        }

        case '[CADENCE: AUDIT BLIND CHARACTER RHYTHM]': {
            const sampleRate = 48000
            const samples = new Float32Array(sampleRate)
            for (let i = 0; i < sampleRate; i++) {
                const active =
                    (i >= 4800 && i <= 12480) ||
                    (i >= 17280 && i <= 24960) ||
                    (i >= 29760 && i <= 37440)
                samples[i] = active ? Math.sin(i * 0.08) * 0.45 : 0.0
            }
            const res = await ste.hunt(ActAud.CLASSIFY_CHARACTER_CADENCE, {
                idx: 'menu-cadence-audit',
                dat: {
                    characterId: 'char_silas',
                    pcmSamples: samples,
                    sampleRateHz: sampleRate,
                    bannedCadences: ['RAPID_STACCATO'],
                },
            })
            const report = res?.audBit?.classificationReport
            const pct = report
                ? (report.cadenceMatchConfidence * 100).toFixed(1)
                : '0.0'
            await ste.hunt(ActBus.EMIT_ASCII_TELEMETRY, {
                idx: 'menu-cadence-receipt',
                dat: {
                    level: 'OK',
                    sinkIdx: 'cns00',
                    message: `[CADENCE:COCKPIT] Confidence: ${pct}% | Status: ${report?.status || 'UNKNOWN'}`,
                },
            })
            break
        }

        case 'ROOT MENU':
        default: {
            if (rootSlv) {
                const resolve = rootSlv
                rootSlv = null
                resolve({ mnuBit: { idx: 'root-menu', val: 0 } })
            }
            return cpy
        }
    }

    // Non-recursive re-entrant tick scheduler (333ms) yielding to Node.js event loop
    setTimeout(() => {
        void ste.hunt(ActMnu.UPDATE_MENU, bal)
    }, 333)

    return cpy
}
