import type Model from './fce/model.interface.js'
import type {
    VocoderEngineType,
    VocoderEngineDescriptor,
    LatentTensorDescriptor,
} from './fce/model.interface.js'
import type ModelBit from './fce/model.bit.js'

export class ModelModel implements Model {
    idx: string = '96.model'
    activeEngine: VocoderEngineType = 'styletts2'
    maxAllowedRamBytes: number = 8589934592 // 8.0 GB Rig 1 CPU ceiling
    engines: Record<VocoderEngineType, VocoderEngineDescriptor> = {
        styletts2: {
            engineId: 'styletts2',
            displayName: 'StyleTTS-2 (LibriTTS Baseline)',
            checkpointRelativePath: 'checkpoints/styletts2/model.safetensors',
            supportsMmapLatent: true,
            sampleRateHz: 48000,
            minimumRamRequiredBytes: 2147483648, // 2.0 GB
            executableSubprocessPath: 'python3 -m inference.styletts2_spawner',
        },
        parler: {
            engineId: 'parler',
            displayName: 'Parler-TTS (Mini Expressive)',
            checkpointRelativePath: 'checkpoints/parler/model.safetensors',
            supportsMmapLatent: true,
            sampleRateHz: 44100,
            minimumRamRequiredBytes: 1610612736, // 1.5 GB
            executableSubprocessPath: 'python3 -m inference.parler_spawner',
        },
        piper: {
            engineId: 'piper',
            displayName: 'Piper ONNX Low-Latency Vocoder',
            checkpointRelativePath: 'checkpoints/piper/model.onnx',
            supportsMmapLatent: false,
            sampleRateHz: 22050,
            minimumRamRequiredBytes: 536870912, // 512 MB
            executableSubprocessPath: './piper',
        },
        cosyvoice: {
            engineId: 'cosyvoice',
            displayName: 'CosyVoice (Zero-Shot Clone)',
            checkpointRelativePath: 'checkpoints/cosyvoice/model.pt',
            supportsMmapLatent: true,
            sampleRateHz: 48000,
            minimumRamRequiredBytes: 3221225472, // 3.0 GB
            executableSubprocessPath: 'python3 -m inference.cosyvoice_spawner',
        },
        kokoro: {
            engineId: 'kokoro',
            displayName: 'Kokoro ONNX (Edge Target)',
            checkpointRelativePath: 'checkpoints/kokoro/model.onnx',
            supportsMmapLatent: false,
            sampleRateHz: 24000,
            minimumRamRequiredBytes: 268435456, // 256 MB
            executableSubprocessPath: './kokoro-runner',
        },
    }
    loadedTensors: Record<string, LatentTensorDescriptor> = {}
    modelsLoadedCount: number = 0
    modelBits: Record<string, ModelBit> = {}
}
