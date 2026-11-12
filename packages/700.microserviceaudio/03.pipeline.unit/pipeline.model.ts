import type Pipeline from './fce/pipeline.interface.js'
import type { PipelineExecutionReport } from './fce/pipeline.interface.js'
import type PipelineBit from './fce/pipeline.bit.js'

export class PipelineModel implements Pipeline {
    idx: string = '03.pipeline'
    pipelinesExecutedCount: number = 0
    pipelinesPassedCount: number = 0
    pipelinesFailedCount: number = 0
    lastReport: PipelineExecutionReport | null = null
    pipelineBits: Record<string, PipelineBit> = {}
}
