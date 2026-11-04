import { describe, it, expect, vi } from 'vitest'
import { initMicroserviceaudio } from './buz/microserviceaudio.buzz.js'
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

        // Check if initMicroserviceaudio is a function and can be called
        expect(typeof initMicroserviceaudio).toBe('function')

        const result = initMicroserviceaudio(model, bal, state)
        expect(result).toBe(model)
        //expect(slv).toHaveBeenCalledWith({ intBit: { idx: 'init-microserviceaudio' } });
    })

    it('should wake up the microserviceaudio if url is provided', async () => {
        const model = new MicroserviceaudioModel()
        const state = {} as any
        const slv = vi.fn()
        const bal = { idx: 'test', slv } as any

        const urlmicroserviceaudio =
            'https://zero00-microserviceaudio.onrender.com/api/microserviceaudio/test'

        const mockResponsemicroserviceaudio = {
            status: 'microserviceaudio-awake',
        }

        const globalFetch = vi
            .spyOn(global, 'fetch')
            .mockImplementation((url) => {
                if (url === urlmicroserviceaudio) {
                    return Promise.resolve({
                        ok: true,
                        json: () =>
                            Promise.resolve(mockResponsemicroserviceaudio),
                    } as any)
                }
                return Promise.reject(new Error('Unknown URL'))
            })

        initMicroserviceaudio(model, bal, state)

        // Wait for the promise in initMicroserviceaudio to resolve
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(globalFetch).toHaveBeenCalledWith(urlmicroserviceaudio)
        expect(slv).toHaveBeenCalledWith({
            intBit: {
                idx: 'init-microserviceaudio',
                dat: {
                    microserviceaudio: mockResponsemicroserviceaudio,
                },
            },
        })

        globalFetch.mockRestore()
    })

    it('should handle fetch errors', async () => {
        const model = new MicroserviceaudioModel()
        const state = {} as any
        const slv = vi.fn()
        const bal = { idx: 'test', slv } as any

        const urlmicroserviceaudio =
            'https://zero00-microserviceaudio.onrender.com/api/microserviceaudio/test'

        const errorMessage = 'Network error'
        const globalFetch = vi
            .spyOn(global, 'fetch')
            .mockImplementation((url) => {
                if (url === urlmicroserviceaudio) {
                    return Promise.reject(new Error(errorMessage))
                }
                return Promise.resolve({
                    ok: true,
                    json: async () => ({}),
                } as any)
            })

        initMicroserviceaudio(model, bal, state)

        // Wait for the promise in initMicroserviceaudio to resolve
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(globalFetch).toHaveBeenCalledWith(urlmicroserviceaudio)

        expect(slv).toHaveBeenCalledWith({
            intBit: { idx: 'init-microserviceaudio-err', dat: errorMessage },
        })

        globalFetch.mockRestore()
    })
})
