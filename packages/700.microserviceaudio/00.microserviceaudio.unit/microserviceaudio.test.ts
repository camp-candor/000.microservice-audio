import { describe, it, expect, vi } from 'vitest'
import {
    initMicroserviceaudio,
    updateMicroserviceaudio,
} from './buz/microserviceaudio.buzz.js'
import { MicroserviceaudioModel } from './microserviceaudio.model.js'

describe('microserviceaudio', () => {
    it('should initialize microserviceaudio', () => {
        const model = new MicroserviceaudioModel()
        const state = {
            hunt: vi.fn().mockResolvedValue({}),
            dispatch: vi.fn(),
        } as any

        const slv = vi.fn()
        const bal = { idx: 'test', slv } as any

        expect(typeof initMicroserviceaudio).toBe('function')

        const result = initMicroserviceaudio(model, bal, state)
        expect(result).toBe(model)
        expect(slv).toHaveBeenCalledWith({
            msaBit: { idx: 'init-microserviceaudio', val: 1 },
        })
    })

    it('should update microserviceaudio and store bit in model', () => {
        const model = new MicroserviceaudioModel()
        const slv = vi.fn()
        const bal = { idx: 'test-bit', slv } as any

        const result = updateMicroserviceaudio(model, bal)
        expect(result.microserviceaudioBits['test-bit']).toBe(bal)
        expect(slv).toHaveBeenCalledWith({ msaBit: bal })
    })
})
