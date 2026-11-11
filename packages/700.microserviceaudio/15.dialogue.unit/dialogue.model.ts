import type Dialogue from './fce/dialogue.interface.js'
import type { SeriesLexiconDictionary, CadenceAuditRecord } from './fce/dialogue.interface.js'
import type DialogueBit from './fce/dialogue.bit.js'

export class DialogueModel implements Dialogue {
  idx: string = '15.dialogue'
  activeSeriesSlug: string = 'wiregrass-basin'
  cachedLexicons: Record<string, SeriesLexiconDictionary> = {}
  linesProcessed: number = 0
  cadenceAuditsCompleted: number = 0
  prohibitedBreachesDetected: number = 0
  cadenceAuditLog: CadenceAuditRecord[] = []
  dialogueBits: Record<string, DialogueBit> = {}
}
