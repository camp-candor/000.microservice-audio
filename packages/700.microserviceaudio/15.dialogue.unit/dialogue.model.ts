import type Dialogue from './fce/dialogue.interface.js'
import type { SeriesLexiconDictionary } from './fce/dialogue.interface.js'
import type DialogueBit from './fce/dialogue.bit.js'

export class DialogueModel implements Dialogue {
  idx: string = '15.dialogue'
  activeSeriesSlug: string = 'wiregrass-basin'
  cachedLexicons: Record<string, SeriesLexiconDictionary> = {}
  linesProcessed: number = 0
  dialogueBits: Record<string, DialogueBit> = {}
}
