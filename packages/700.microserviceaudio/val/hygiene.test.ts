import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { list, reducer } from '../BEE.js'
import UnitData from '../BEE.js'

describe('Phase 1: Workspace Hygiene & 21-Unit State Machine Closure', () => {
    it('BEE.ts registers all 22 unit constructors in list', () => {
        expect(list.length).toBe(22)
    })

    it('BEE.ts registers all 22 slice reducers in reducer map', () => {
        const keys = Object.keys(reducer)
        expect(keys).toContain('acoustic')
        expect(keys).toContain('conditioning')
        expect(keys).toContain('pipeline')
        expect(keys).toContain('integration')
        expect(keys).toContain('verification')
        expect(keys).toContain('generate')
        expect(keys).toContain('loudness')
        expect(keys).toContain('peaks')
        expect(keys).toContain('transcription')
        expect(keys).toContain('schemas')
        expect(keys).toContain('filter')
        expect(keys).toContain('deesser')
        expect(keys).toContain('bus')
        expect(keys).toContain('menu')
        expect(keys).toContain('collect')
        expect(keys.length).toBe(22)
    })

    it('UnitData model instantiates all unit models without throwing', () => {
        const data = new UnitData()
        expect(data.acoustic).toBeDefined()
        expect(data.conditioning).toBeDefined()
        expect(data.generate).toBeDefined()
        expect(data.bus).toBeDefined()
        expect(data.collect).toBeDefined()
    })

    it('asserts packages/700.microserviceaudio/src/ does not exist on disk', () => {
        const srcDir = path.resolve(__dirname, '../src')
        expect(fs.existsSync(srcDir)).toBe(false)
    })

    it('asserts zero V8 debug statements exist across packages/700.microserviceaudio/', () => {
        const pkgRoot = path.resolve(__dirname, '..')
        const scanDir = (dir: string): string[] => {
            let offenses: string[] = []
            const entries = fs.readdirSync(dir, { withFileTypes: true })
            for (const entry of entries) {
                if (entry.name === 'node_modules' || entry.name === 'dist')
                    continue
                const full = path.join(dir, entry.name)
                if (entry.isDirectory()) {
                    offenses = offenses.concat(scanDir(full))
                } else if (
                    entry.name.endsWith('.ts') &&
                    !entry.name.endsWith('.test.ts')
                ) {
                    const content = fs.readFileSync(full, 'utf8')
                    const kw = 'debug' + 'ger'
                    if (new RegExp('\\b' + kw + '\\b').test(content)) {
                        offenses.push(full)
                    }
                }
            }
            return offenses
        }
        const debuggerFiles = scanDir(pkgRoot)
        expect(debuggerFiles).toEqual([])
    })

    it('asserts pure 7-bit ASCII compliance across packages/700.microserviceaudio/', () => {
        const pkgRoot = path.resolve(__dirname, '..')
        const scanDir = (dir: string): string[] => {
            let offenses: string[] = []
            const entries = fs.readdirSync(dir, { withFileTypes: true })
            for (const entry of entries) {
                if (entry.name === 'node_modules' || entry.name === 'dist')
                    continue
                const full = path.join(dir, entry.name)
                if (entry.isDirectory()) {
                    offenses = offenses.concat(scanDir(full))
                } else if (entry.name.endsWith('.ts')) {
                    const buf = fs.readFileSync(full)
                    for (let i = 0; i < buf.length; i++) {
                        if (buf[i] > 127) {
                            offenses.push(
                                `${full} (byte 0x${buf[i].toString(16)} at index ${i})`,
                            )
                            break
                        }
                    }
                }
            }
            return offenses
        }
        const nonAsciiFiles = scanDir(pkgRoot)
        expect(nonAsciiFiles).toEqual([])
    })
})
