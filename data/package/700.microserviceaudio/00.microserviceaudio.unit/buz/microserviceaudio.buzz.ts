import { MicroserviceaudioModel } from '../microserviceaudio.model.js'
import MicroserviceaudioBit from '../fce/microserviceaudio.bit.js'
import State from '../../99.core/state.js'

const microserviceaudio = {
    list: async () => {
        return { models: [] as any[] }
    },
}

export const initMicroserviceaudio = (cpy: MicroserviceaudioModel, bal: MicroserviceaudioBit, ste: State) => {
    const url =
        process.env.MICROSERVICEAUDIO_URL ||
        'https://zero00-microserviceaudio.onrender.com/api/microserviceaudio/test'
    if (url) {
        fetch(url)
            .then((response) => response.json())
            .then((data) => {
                if (bal.slv != null) {
                    bal.slv({
                        intBit: {
                            idx: 'init-microserviceaudio',
                            dat: {
                                microserviceaudio: data,
                            },
                        },
                    })
                }
            })
            .catch((error: any) => {
                if (bal.slv != null) {
                    bal.slv({
                        intBit: { idx: 'init-microserviceaudio-err', dat: error.message },
                    })
                }
            })
    } else {
        if (bal.slv != null) {
            bal.slv({ intBit: { idx: 'init-microserviceaudio' } })
        }
    }
    return cpy
}

export const updateMicroserviceaudio = (
    cpy: MicroserviceaudioModel,
    bal: MicroserviceaudioBit,
    ste: State,
) => {
    bal.slv({ intBit: { idx: 'update-microserviceaudio' } })

    return cpy
}

export const testMicroserviceaudio = (cpy: MicroserviceaudioModel, bal: MicroserviceaudioBit, ste: State) => {
    bal.slv({ mytBit: { idx: 'test-microserviceaudio', val: 1 } })
    return cpy
}

export const listMicroserviceaudio = async (
    cpy: MicroserviceaudioModel,
    bal: MicroserviceaudioBit,
    ste: State,
) => {
    const response = await microserviceaudio.list()
    if (bal.slv != null)
        bal.slv({
            olmBit: {
                idx: 'list-microserviceaudio',
                lst: response.models.map((m: any) => m.name),
            },
        })
    return cpy
}
